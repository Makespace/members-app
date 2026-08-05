import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as RR from 'fp-ts/ReadonlyRecord';

import {Dependencies} from '../../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {Equipment, MemberCoreInfo} from '../shared-state/return-types';
import {DateTime, Duration} from 'luxon';
import {ReadonlyRecord} from 'fp-ts/lib/ReadonlyRecord';
import {EquipmentId} from '../../types/equipment-id';
import {TrainingQuizCompletionRow} from '../shared-state/training-quiz/get';

export type OrphanedPassedQuiz = {
  waitingSince: Date;
  memberNumberProvided: O.Option<number>;
  emailProvided: O.Option<string>;
};

export type MemberAwaitingTraining = Pick<
  MemberCoreInfo,
  'memberNumber' | 'name' | 'pastMemberNumbers'
> & {
  waitingSince: Date;
};

// Event-native quiz row carrying only the fields the renderers consume (the
// events table has no sheet_name/row_index/cached_at/percentage columns).
export type QuizRow = {
  completedAt: Date;
  memberNumberProvided: O.Option<number>;
  emailProvided: O.Option<string>;
  score: number;
  maxScore: number;
  percentage: number;
  trainingSheetId: string;
};

// Full marks. The `maxScore > 0` guard avoids a spurious pass on a malformed
// 0/0 row (the old sheet rule was a stored `percentage >= 100`).
const isPassed = (r: {score: number; maxScore: number}) =>
  r.maxScore > 0 && r.score >= r.maxScore;

const toPercentage = (score: number, maxScore: number): number =>
  maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);

const toQuizRow = (row: TrainingQuizCompletionRow): QuizRow => ({
  completedAt: row.completedAt,
  memberNumberProvided: row.memberNumberProvided,
  emailProvided: row.emailProvided,
  score: row.score,
  maxScore: row.maxScore,
  percentage: toPercentage(row.score, row.maxScore),
  trainingSheetId: row.trainingSheetId,
});

export type FullQuizResultsForEquipment = {
  lastQuizSync: O.Option<Date>;
  membersAwaitingTraining: ReadonlyArray<MemberAwaitingTraining>;
  unknownMembersAwaitingTraining: ReadonlyArray<OrphanedPassedQuiz>;
  failedQuizes: ReadonlyArray<QuizRow>;
};

export const getFullQuizResultsForEquipment = (
  deps: Pick<Dependencies, 'sharedReadModel' | 'lastQuizSync'>,
  sheetId: string,
  equipment: Equipment
): TE.TaskEither<string, FullQuizResultsForEquipment> =>
  pipe(
    // The sheet cache still syncs, so lastQuizSync remains the "data last
    // refreshed" signal shown on the page even though quiz rows now come from
    // events.
    deps.lastQuizSync(sheetId),
    TE.map(lastQuizSync => {
      const completions =
        deps.sharedReadModel.trainingQuiz.getCompletionsForSheet(
          sheetId,
          O.some(
            DateTime.now().minus(Duration.fromObject({year: 1})).toJSDate()
          )
        );

      const membersAwaitingTraining: MemberAwaitingTraining[] = [];
      const unknownMembersAwaitingTraining: OrphanedPassedQuiz[] = [];
      const trainedMemberNumbers = equipment.trainedMembers.map(
        m => m.memberNumber
      );

      for (const row of completions.filter(isPassed)) {
        // A passed row with no member number is dropped (not surfaced as
        // unknown) - preserving the previous behaviour.
        if (O.isNone(row.memberNumberProvided)) {
          continue;
        }
        const memberNumber = row.memberNumberProvided.value;
        if (trainedMemberNumbers.includes(memberNumber)) {
          continue;
        }
        const member =
          deps.sharedReadModel.members.getByMemberNumber(memberNumber);
        if (O.isNone(member)) {
          unknownMembersAwaitingTraining.push({
            waitingSince: row.completedAt,
            memberNumberProvided: row.memberNumberProvided,
            emailProvided: row.emailProvided,
          });
          continue;
        }
        membersAwaitingTraining.push({
          ...member.value,
          waitingSince: row.completedAt,
        });
      }

      return {
        lastQuizSync,
        failedQuizes: completions.filter(row => !isPassed(row)).map(toQuizRow),
        membersAwaitingTraining,
        unknownMembersAwaitingTraining,
      };
    })
  );

export type FullQuizResultsForMember = {
  equipmentQuiz: ReadonlyRecord<
    EquipmentId,
    {
      passedAt: ReadonlyArray<Date>;
      attempted: ReadonlyArray<{
        response_submitted: Date;
        sheet_id: string;
        score: number;
        max_score: number;
        percentage: number;
      }>;
    }
  >;
};

export const getFullQuizResultsForMember = (
  deps: Pick<Dependencies, 'sharedReadModel'>,
  memberNumber: number
): TE.TaskEither<string, FullQuizResultsForMember> => {
  const equipmentQuiz: Record<
    EquipmentId,
    {
      passedAt: Date[];
      attempted: {
        response_submitted: Date;
        sheet_id: string;
        score: number;
        max_score: number;
        percentage: number;
      }[];
    }
  > = {};
  const trainingSheetMapping =
    deps.sharedReadModel.equipment.getTrainingSheetIdMapping();

  for (const row of deps.sharedReadModel.trainingQuiz.getCompletionsForMember(
    memberNumber
  )) {
    const equipmentId = RR.lookup(row.trainingSheetId)(trainingSheetMapping);
    if (O.isNone(equipmentId)) {
      continue;
    }
    if (!equipmentQuiz[equipmentId.value]) {
      equipmentQuiz[equipmentId.value] = {passedAt: [], attempted: []};
    }
    if (isPassed(row)) {
      equipmentQuiz[equipmentId.value].passedAt.push(row.completedAt);
    } else {
      equipmentQuiz[equipmentId.value].attempted.push({
        response_submitted: row.completedAt,
        sheet_id: row.trainingSheetId,
        score: row.score,
        max_score: row.maxScore,
        percentage: toPercentage(row.score, row.maxScore),
      });
    }
  }

  return TE.right({equipmentQuiz});
};
