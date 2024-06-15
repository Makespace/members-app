import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {readModels} from '../../read-models';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failureWithStatus';
import {QuizResultViewModel, ViewModel} from './view-model';
import {User} from '../../types';
import {StatusCodes} from 'http-status-codes';
import {DomainEvent, EventOfType} from '../../types/domain-event';
import {DateTime} from 'luxon';

const constructQuizResultViewModel = (
  event: EventOfType<'EquipmentTrainingQuizResult'>
): QuizResultViewModel => {
  return {
    email: event.email,
    score: event.score,
    maxScore: event.maxScore,
    percentage: event.percentage,
    passed: event.fullMarks,
    timestamp: DateTime.fromSeconds(event.timestampEpochS),
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
  equipmentId: string
) =>
  pipe(
    readModels.equipment.getTrainingQuizResults(events)(equipmentId, O.none),
    trainingQuizResults => ({
      passed: RA.map(constructQuizResultViewModel)(trainingQuizResults.passed),
      all: RA.map(constructQuizResultViewModel)(trainingQuizResults.all),
    }),
    TE.right
  );

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (equipmentId: string): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      {user},
      TE.right,
      TE.bind('events', () => deps.getAllEvents()),
      TE.bind('equipment', ({events}) => getEquipment(events, equipmentId)),
      TE.bindW('trainingQuizResults', ({events}) =>
        getQuizResults(events, equipmentId)
      ),
      TE.bind('isSuperUserOrOwnerOfArea', () => TE.right(true))
    );
