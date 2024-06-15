import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
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
import {sequenceS} from 'fp-ts/lib/Apply';
import {EventOfType} from '../../types/domain-event';
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

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (equipmentId: string): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.map(events => {
        const equipmentOption = pipe(
          equipmentId,
          readModels.equipment.get(events),
          E.fromOption(() =>
            failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
          )
        );
        return {
          user: E.right(user),
          isSuperUserOrOwnerOfArea: E.right(true),
          equipment: equipmentOption,
          trainingQuizResults: pipe(
            equipmentOption,
            E.map(equipment =>
              pipe(
                readModels.equipment.getTrainingQuizResults(events)(
                  equipment.id,
                  O.none
                ),
                trainingQuizResults => ({
                  passed: RA.map(constructQuizResultViewModel)(
                    trainingQuizResults.passed
                  ),
                  all: RA.map(constructQuizResultViewModel)(
                    trainingQuizResults.all
                  ),
                })
              )
            )
          ),
        };
      }),
      TE.chainEitherK(sequenceS(E.Apply))
    );
