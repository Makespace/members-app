import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {readModels} from '../../read-models';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {QuizResultViewModel, ViewModel} from './view-model';
import {User} from '../../types';
import {StatusCodes} from 'http-status-codes';
import {DomainEvent, EventOfType} from '../../types/domain-event';
import {DateTime} from 'luxon';
import {Equipment} from '../../read-models/equipment/get';

const constructQuizResultViewModel = (
  event: EventOfType<'EquipmentTrainingQuizResult'>
): QuizResultViewModel => {
  return {
    id: event.id,
    score: event.score,
    maxScore: event.maxScore,
    percentage: event.percentage,
    passed: event.fullMarks,
    timestamp: DateTime.fromSeconds(event.timestampEpochS),

    email: event.email,
  };
};

const getEquipment = (
  events: ReadonlyArray<DomainEvent>,
  equipmentId: string
) =>
  pipe(
    equipmentId,
    readModels.equipment.get(events),
    TE.fromOption(() =>
      failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
    )
  );

const getQuizResults = (
  events: ReadonlyArray<DomainEvent>,
  equipment: Equipment
): TE.TaskEither<
  FailureWithStatus,
  {
    quiz_passed_not_trained: ReadonlyArray<QuizResultViewModel>;
    failed_quiz_not_passed: ReadonlyArray<QuizResultViewModel>;
  }
> => {
  // Get quiz results for member + email where it matches.
  // Get quiz results that don't match.
  // Allow dismissing a quiz result.
  

  const quizResultEvents = readModels.equipment.getTrainingQuizResults(events)(
    equipment.id
  );
  const members = readModels.members.getAllDetails(events);


  let member_training_events = {

  }

  let per_s


};
pipe(
  readModels.equipment.getTrainingQuizResults(events)(equipmentId, O.none),
  trainingQuizResults => ({
    passed: RA.map(constructQuizResultViewModel)(trainingQuizResults.passed),
    all: RA.map(constructQuizResultViewModel)(trainingQuizResults.all),
  }),
  TE.right
);

const isSuperUserOrOwnerOfArea = (
  events: ReadonlyArray<DomainEvent>,
  areaId: string,
  memberNumber: number
) =>
  TE.right(
    readModels.superUsers.is(memberNumber)(events) ||
      readModels.areas.isOwner(events)(areaId, memberNumber)
  );

const isSuperUserOrTrainerOfEquipment = (
  events: ReadonlyArray<DomainEvent>,
  equipment: Equipment,
  memberNumber: number
) =>
  TE.right(
    readModels.superUsers.is(memberNumber)(events) ||
      equipment.trainers.includes(memberNumber)
  );

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (equipmentId: string): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      {user},
      TE.right,
      TE.bind('events', () => deps.getAllEvents()),
      TE.bind('equipment', ({events}) => getEquipment(events, equipmentId)),
      TE.bindW('isSuperUserOrOwnerOfArea', ({events, equipment}) =>
        isSuperUserOrOwnerOfArea(events, equipment.areaId, user.memberNumber)
      ),
      TE.bindW('isSuperUserOrTrainerOfArea', ({events, equipment}) =>
        isSuperUserOrTrainerOfEquipment(events, equipment, user.memberNumber)
      ),
      TE.bindW('trainingQuizResults', ({events, equipment}) =>
        getQuizResults(events, equipment)
      )
    );
