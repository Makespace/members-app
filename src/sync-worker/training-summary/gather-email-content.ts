import {DateTime, Duration} from 'luxon';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import * as S from 'fp-ts/string';
import * as RA from 'fp-ts/ReadonlyArray';
import {Equipment} from '../../read-models/shared-state/return-types';
import {SanitizedString, sanitizeString} from '../../types/html';
import {UserId} from '../../types';
import {getFullQuizResultsForEquipment} from '../../read-models/external-state/equipment-quiz';
import {pipe} from 'fp-ts/lib/function';
import {contramap} from 'fp-ts/lib/Ord';
import {TrainingSummaryDeps} from './training-summary-deps';
import {
  getRecurlyReasonsForMember,
  isActiveForOwnership,
  RecurlyFlags,
} from '../../read-models/external-state/recurly-status';

type EquipmentTrainingStats = {
  name: SanitizedString;
  awaitingTraining: O.Option<number>;
  trainedTotal: number;
  trainedLast30Days: number;
  equipmentLink: URL;
  trainerCount: number;
  // "Active Owners" in the email: the trainers able to deliver training on
  // this equipment (every trainer must be an owner) whose membership is
  // currently active.
  activeOwnerCount: number;
  percentageOfActiveMembershipTrained: number;
};

export type EmailContent = {
  trainingStatsPerEquipment: ReadonlyArray<EquipmentTrainingStats>;
  totalActiveMembers: number;
  totalTrainingsLast30Days: number;
  totalTrainings: number;
  membersJoinedWithin30Days: number;
};

const byName = pipe(
  S.Ord,
  contramap((e: EquipmentTrainingStats) => e.name)
);

const createEquipmentLink = (publicUrl: string, equipment: Equipment) =>
  new URL(`${publicUrl}/equipment/${equipment.id}`);

// Counts the trainers of this equipment whose membership is currently active.
// Looked up by userId, the member's stable identity: a trainer may hold
// several member numbers. No fresh Recurly data counts a trainer out, so a
// broken Recurly sync makes the column under-report rather than over-report;
// gatherEmailContent warns once about it in aggregate.
const countActiveOwners =
  (flagsByUserId: ReadonlyMap<UserId, O.Option<RecurlyFlags>>) =>
  (equipment: Equipment): number =>
    equipment.trainers.filter(trainer =>
      isActiveForOwnership(flagsByUserId.get(trainer.userId) ?? O.none)
    ).length;

const gatherEmailContentForEquipment =
  (deps: TrainingSummaryDeps) =>
  async (
    equipment: Equipment,
    totalActiveMembers: number,
    flagsByUserId: ReadonlyMap<UserId, O.Option<RecurlyFlags>>
  ): Promise<EquipmentTrainingStats> => {
    const qzResults = O.isNone(equipment.trainingSheetId)
      ? E.left('No training sheet registered')
      : await getFullQuizResultsForEquipment(
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
      activeOwnerCount: countActiveOwners(flagsByUserId)(equipment),
      percentageOfActiveMembershipTrained:
        totalActiveMembers > 0
          ? Math.round(
              (equipment.trainedMembers.length / totalActiveMembers) * 100
            )
          : 0,
    };
  };

export const gatherEmailContent = async (
  deps: TrainingSummaryDeps
): Promise<EmailContent> => {
  const result = [];
  const members = deps.sharedReadModel.members.getAll();
  const flagsByUserId = new Map<UserId, O.Option<RecurlyFlags>>();
  let totalActiveMembers = 0;
  for (const member of members) {
    const {flags} = await getRecurlyReasonsForMember(deps.extDB)(member);
    flagsByUserId.set(member.userId, flags);
    // Same verdict as the shared 'active' status: some fresh subscription row
    // is active. Past-due only matters for the ownership rule below.
    if (O.isSome(flags) && flags.value.hasActiveSubscription) {
      totalActiveMembers += 1;
    }
  }
  const cutoff30Days =
    new Date().getTime() - Duration.fromObject({days: 30}).as('milliseconds');
  const membersJoinedWithin30Days = members.filter(
    member => member.joined.getTime() > cutoff30Days
  ).length;
  // Only red equipment has training, so orange and green are left out.
  const redEquipment = deps.sharedReadModel.equipment
    .getAll()
    .filter(equipment => equipment.category === 'red');
  for (const equipment of redEquipment) {
    // Sequential gather as we can afford to be slower.
    result.push(
      await gatherEmailContentForEquipment(deps)(
        equipment,
        totalActiveMembers,
        flagsByUserId
      )
    );
  }
  // One line for the whole run rather than one per affected machine: a lapsed
  // trainer on several machines, or a broken Recurly sync zeroing every
  // count, should be visible without flooding the log.
  const uncheckedTrainerCount = [
    ...new Set(redEquipment.flatMap(equipment => equipment.trainers.map(
      trainer => trainer.userId
    ))),
  ].filter(userId => O.isNone(flagsByUserId.get(userId) ?? O.none)).length;
  if (uncheckedTrainerCount > 0) {
    deps.logger.warn(
      'No fresh Recurly data for %s trainer(s) on the equipment listed; they are not counted as active owners. If the counts look wrong, check the Recurly sync.',
      uncheckedTrainerCount
    );
  }
  return {
    trainingStatsPerEquipment: RA.sortBy([byName])(result),
    totalActiveMembers,
    totalTrainings: result.reduce(
      (prev, current) => prev + current.trainedTotal,
      0
    ),
    totalTrainingsLast30Days: result.reduce(
      (prev, current) => prev + current.trainedLast30Days,
      0
    ),
    membersJoinedWithin30Days,
  };
};
