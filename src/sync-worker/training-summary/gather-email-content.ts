import {DateTime, Duration} from 'luxon';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import * as S from 'fp-ts/string';
import * as RA from 'fp-ts/ReadonlyArray';
import {Equipment} from '../../read-models/shared-state/return-types';
import {SanitizedString, sanitizeString} from '../../types/html';
import {getFullQuizResults} from '../../read-models/external-state/equipment-quiz';
import {pipe} from 'fp-ts/lib/function';
import {contramap} from 'fp-ts/lib/Ord';
import {TrainingSummaryDeps} from './training-summary-deps';

type EquipmentTrainingStats = {
  name: SanitizedString;
  awaitingTraining: O.Option<number>;
  trainedTotal: number;
  trainedLast30Days: number;
  equipmentLink: URL;
  trainerCount: number;
  percentageOfActiveMembershipTrained: number;
};

export type EmailContent = {
  trainingStatsPerEquipment: ReadonlyArray<EquipmentTrainingStats>;
  totalActiveMembers: number;
  membersJoinedWithin30Days: number;
};

const byName = pipe(
  S.Ord,
  contramap((e: EquipmentTrainingStats) => e.name)
);

const createEquipmentLink = (publicUrl: string, equipment: Equipment) =>
  new URL(`${publicUrl}/equipment/${equipment.id}`);

const gatherEmailContentForEquipment =
  (deps: TrainingSummaryDeps) =>
  async (
    equipment: Equipment,
    totalActiveMembers: number
  ): Promise<EquipmentTrainingStats> => {
    const qzResults = O.isNone(equipment.trainingSheetId)
      ? E.left('No training sheet registered')
      : await getFullQuizResults(
          deps,
          equipment.trainingSheetId.value,
          equipment
        )();

    let awaitingTraining: O.Option<number> = O.none;
    if (E.isLeft(qzResults)) {
      deps.logger.warn(
        'Failed to get members awaiting training for email content: %s',
        qzResults.left
      );
    } else {
      awaitingTraining = O.some(qzResults.right.membersAwaitingTraining.length);
    }

    const equipmentLink = createEquipmentLink(deps.conf.PUBLIC_URL, equipment);

    return {
      name: sanitizeString(equipment.name),
      awaitingTraining,
      trainedTotal: equipment.trainedMembers.length,
      trainedLast30Days: equipment.trainedMembers.filter(
        member =>
          DateTime.fromJSDate(member.trainedSince).diffNow().negate() <
          Duration.fromObject({days: 30})
      ).length,
      equipmentLink,
      trainerCount: equipment.trainers.length,
      percentageOfActiveMembershipTrained:
        totalActiveMembers > 0
          ? Math.round(equipment.trainedMembers.length / totalActiveMembers)
          : 0,
    };
  };

export const gatherEmailContent = async (
  deps: TrainingSummaryDeps
): Promise<EmailContent> => {
  const result = [];
  const members = deps.sharedReadModel.members.getAll();
  const totalActiveMembers = members.reduce(
    (total, member) => (member.status === 'active' ? total + 1 : total),
    0
  );
  const cutoff30Days =
    new Date().getTime() - Duration.fromObject({days: 30}).as('milliseconds');
  const membersJoinedWithin30Days = members.filter(
    member => member.joined.getTime() > cutoff30Days
  ).length;
  for (const equipment of deps.sharedReadModel.equipment.getAll()) {
    // Sequential gather as we can afford to be slower.
    result.push(
      await gatherEmailContentForEquipment(deps)(equipment, totalActiveMembers)
    );
  }
  return {
    trainingStatsPerEquipment: RA.sortBy([byName])(result),
    totalActiveMembers,
    membersJoinedWithin30Days,
  };
};
