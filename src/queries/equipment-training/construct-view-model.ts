import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import {EquipmentCategory} from '../../types/equipment-category';
import {equipmentGuideUrl} from '../../templates/equipment-guide-url';
import {
  QuarterCount,
  trainingsByQuarter,
} from '../../read-models/shared-state/member/training-delivered';
import {DateTime} from 'luxon';

// Where the member has got to, told from their own quiz results and training
// record rather than from a list of everybody: a member on this page is
// asking about themselves.
export type Progress =
  | {tag: 'trained'; since: Date}
  | {tag: 'passed'; completedAt: Date}
  | {tag: 'failed'; completedAt: Date; score: number; maxScore: number}
  | {tag: 'not-attempted'}
  // The equipment has no quiz registered, so there is no result to have.
  | {tag: 'no-quiz'};

export type ViewModel = {
  equipment: {
    id: UUID;
    name: string;
    category: EquipmentCategory;
  };
  area: {name: string; email: O.Option<string>};
  guideUrl: string;
  progress: Progress;
  // Who can actually run a practical, and how recently each of them has -
  // a list of names says less than a list of names with their record beside
  // it, when you are deciding whether to wait or to email.
  trainers: ReadonlyArray<{
    memberNumber: number;
    name: O.Option<string>;
    trainingsByQuarter: ReadonlyArray<QuarterCount>;
  }>;
  lastTraining: O.Option<Date>;
};

const isPass = (row: {score: number; maxScore: number}) =>
  row.maxScore > 0 && row.score >= row.maxScore;

const progressFor = (
  deps: Dependencies,
  user: User,
  equipment: {id: UUID; trainingSheetId: O.Option<string>}
): Progress => {
  const trainedSince = pipe(
    deps.sharedReadModel.members.getByMemberNumber(user.memberNumber),
    O.chain(member =>
      pipe(
        member.trainedOn.find(item => item.id === (equipment.id as string)),
        O.fromNullable
      )
    ),
    O.map(item => item.trainedAt)
  );
  if (O.isSome(trainedSince)) {
    return {tag: 'trained', since: trainedSince.value};
  }

  if (O.isNone(equipment.trainingSheetId)) {
    return {tag: 'no-quiz'};
  }

  const sheetId = equipment.trainingSheetId.value;
  const attempts = deps.sharedReadModel.trainingQuiz
    .getCompletionsForMember(user.memberNumber)
    .filter(row => row.trainingSheetId === sheetId);

  const passed = attempts.filter(isPass);
  if (passed.length > 0) {
    // The earliest pass is the one they have been waiting on since.
    const first = [...passed].sort(
      (a, b) => a.completedAt.getTime() - b.completedAt.getTime()
    )[0];
    return {tag: 'passed', completedAt: first.completedAt};
  }

  if (attempts.length === 0) {
    return {tag: 'not-attempted'};
  }

  // Their best attempt, because that is the one worth beating.
  const best = [...attempts].sort(
    (a, b) =>
      b.score / (b.maxScore || 1) - a.score / (a.maxScore || 1) ||
      b.completedAt.getTime() - a.completedAt.getTime()
  )[0];
  return {
    tag: 'failed',
    completedAt: best.completedAt,
    score: best.score,
    maxScore: best.maxScore,
  };
};

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (equipmentId: UUID): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.sharedReadModel.equipment.get(equipmentId),
      TE.fromOption(
        failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)
      ),
      TE.map(equipment => ({
        equipment: {
          id: equipment.id,
          name: equipment.name,
          category: equipment.category,
        },
        area: {name: equipment.area.name, email: equipment.area.email},
        guideUrl: equipmentGuideUrl(
          equipment.area.name,
          equipment.name,
          equipment.category
        ),
        progress: progressFor(deps, user, equipment),
        trainers: equipment.trainers.map(trainer => ({
          memberNumber: trainer.memberNumber,
          name: trainer.name,
          trainingsByQuarter: trainingsByQuarter(
            deps.sharedReadModel.members.trainingsDeliveredBy(
              [trainer.memberNumber, ...trainer.pastMemberNumbers],
              [equipment.id]
            ),
            DateTime.now()
          ),
        })),
        // The last time anybody was marked trained on this machine: the
        // honest answer to "does anything actually happen here?".
        lastTraining: pipe(
          equipment.trainedMembers.map(member => member.trainedSince),
          dates =>
            dates.length === 0
              ? O.none
              : O.some(
                  dates.reduce((latest, date) =>
                    date > latest ? date : latest
                  )
                )
        ),
      }))
    );
