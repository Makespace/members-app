import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
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

export const constructQuizResultViewModel =
  (passed: boolean) =>
  (event: EventOfType<'EquipmentTrainingQuizResult'>): QuizResultViewModel => {
    return {
      email: event.email,
      score: event.score,
      maxScore: event.maxScore,
      percentage: event.percentage,
      passed,
      timestamp: DateTime.fromSeconds(event.timestampEpochS),
    };
  };

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (equipmentId: string): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.map(events => {
        const equipment = pipe(
          equipmentId,
          readModels.equipment.get(events),
          E.fromOption(() =>
            failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
          )
        );
        return {
          user: E.right(user),
          equipment: pipe(
            equipment,
            E.map(partial => ({...partial, trainers: []}))
          ),
          trainingQuizResults: pipe(
            readModels.equipment.getTrainingQuizResults(events)(
              equipmentId,
              O.none
            ),
            trainingQuizResults => ({
              user,
              equipment: {
                id: equipmentId,
                name: 'todo',
              },
              trainingQuizResults: {
                passed: trainingQuizResults.passed.map(
                  constructQuizResultViewModel(true)
                ),
                all: trainingQuizResults.all.map(
                  constructQuizResultViewModel(false)
                ),
              },
            })
          ),
        };
      }),
      TE.chainEitherK(sequenceS(E.Apply))
    );
