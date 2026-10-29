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
import {
  QuarterCount,
  trainingsByQuarter,
} from '../../read-models/shared-state/member/training-delivered';
import {DateTime} from 'luxon';
import {allMemberNumbers} from '../../read-models/shared-state/return-types';
import {
  TrainingSessionView,
  upcomingTrainingSessions,
} from '../shared-render/upcoming-training-sessions';
import {
  forEquipment,
  MeetupTrainingView,
  upcomingMeetupTrainings,
} from '../shared-render/meetup-trainings';

// Where the member has got to with the quiz, told from their own results
// rather than from a list of everybody: a member on this page is asking about
// themselves. Whether they have been trained is tracked separately, because
// the two steps can be reached in either order - plenty of members were
// trained before the quiz existed.
type QuizProgress =
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
  // The machine's guide, when an owner has recorded one.
  guideUrl: O.Option<string>;
  quiz: QuizProgress;
  // When this member was marked trained on this equipment, if they have been.
  trainedSince: O.Option<Date>;
  // Who can actually run a practical, and how recently each of them has -
  // a list of names says less than a list of names with their record beside
  // it, when you are deciding whether to wait or to email.
  trainers: ReadonlyArray<{
    memberNumber: number;
    name: O.Option<string>;
    trainingsByQuarter: ReadonlyArray<QuarterCount>;
  }>;
  lastTraining: O.Option<Date>;
  upcomingTrainings: ReadonlyArray<TrainingSessionView>;
  // Not every trainer arranges sessions in the app - plenty use Meetup - so
  // the page says how many here do, rather than implying an empty list means
  // nothing is planned.
  trainersUsingApp: number;
  // Whether the quiz must be passed before the practical. When it need not,
  // the page does not ask for it.
  quizRequired: boolean;
  // Machines to be trained on first, by name, and whether this member is.
  prerequisites: ReadonlyArray<Prerequisite>;
  // This machine's trainings on Meetup, which are booked there.
  meetupTrainings: ReadonlyArray<MeetupTrainingView>;
};

type Prerequisite = {id: string; name: string; trained: boolean};

// What stands between a member and a machine's practical, first thing first:
// the machines to be trained on before it, then its quiz. Nothing, once they
// are trained on it - a refresher asks for neither.
export type Readiness =
  | {tag: 'ready'}
  | {tag: 'needs-prerequisites'; missing: ReadonlyArray<Prerequisite>}
  | {tag: 'needs-quiz'};

const prerequisitesFor = (
  deps: Dependencies,
  user: User,
  equipmentId: UUID
): ReadonlyArray<Prerequisite> =>
  deps.sharedReadModel.trainingRequirements
    .get(equipmentId)
    .prerequisiteEquipmentIds.flatMap(id =>
      pipe(
        deps.sharedReadModel.equipment.get(id),
        O.match(
          () => [],
          prerequisite => [
            {
              id: prerequisite.id,
              name: prerequisite.name,
              trained: O.isSome(trainedSinceFor(deps, user, prerequisite.id)),
            },
          ]
        )
      )
    )
    .sort((a, b) => a.name.localeCompare(b.name));

export const readinessFor = (
  deps: Dependencies,
  user: User,
  equipment: {id: UUID; trainingSheetId: O.Option<string>}
): Readiness => {
  if (O.isSome(trainedSinceFor(deps, user, equipment.id))) {
    return {tag: 'ready'};
  }
  const missing = prerequisitesFor(deps, user, equipment.id).filter(
    prerequisite => !prerequisite.trained
  );
  if (missing.length > 0) {
    return {tag: 'needs-prerequisites', missing};
  }
  const quiz = quizProgressFor(deps, user, equipment).tag;
  return deps.sharedReadModel.trainingRequirements.get(equipment.id)
    .quizRequired &&
    (quiz === 'not-attempted' || quiz === 'failed')
    ? {tag: 'needs-quiz'}
    : {tag: 'ready'};
};

const isPass = (row: {score: number; maxScore: number}) =>
  row.maxScore > 0 && row.score >= row.maxScore;

export const trainedSinceFor = (
  deps: Dependencies,
  user: User,
  equipmentId: UUID
): O.Option<Date> =>
  pipe(
    deps.sharedReadModel.members.getByMemberNumber(user.memberNumber),
    O.chain(member =>
      pipe(
        member.trainedOn.find(item => item.id === (equipmentId as string)),
        O.fromNullable
      )
    ),
    O.map(item => item.trainedAt)
  );

const quizProgressFor = (
  deps: Dependencies,
  user: User,
  equipment: {id: UUID; trainingSheetId: O.Option<string>}
): QuizProgress => {
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
      TE.bindTo('equipment'),
      TE.bind('meetup', () => upcomingMeetupTrainings(deps, new Date())),
      TE.map(({equipment, meetup}) => ({
        equipment: {
          id: equipment.id,
          name: equipment.name,
          category: equipment.category,
        },
        area: {name: equipment.area.name, email: equipment.area.email},
        guideUrl: equipment.guideUrl,
        quiz: quizProgressFor(deps, user, equipment),
        trainedSince: trainedSinceFor(deps, user, equipment.id),
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
        upcomingTrainings: upcomingTrainingSessions(
          deps.sharedReadModel,
          equipment,
          new Date(),
          O.some({memberNumber: user.memberNumber})
        ),
        trainersUsingApp: pipe(
          deps.sharedReadModel.trainingSessions.memberNumbersWhoHaveArranged(
            equipment.id
          ),
          arranged =>
            equipment.trainers.filter(trainer =>
              allMemberNumbers(trainer).some(n => arranged.includes(n))
            ).length
        ),
        quizRequired: deps.sharedReadModel.trainingRequirements.get(
          equipment.id
        ).quizRequired,
        prerequisites: prerequisitesFor(deps, user, equipment.id),
        meetupTrainings: forEquipment(meetup, equipment.id),
      }))
    );
