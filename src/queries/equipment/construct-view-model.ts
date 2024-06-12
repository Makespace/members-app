import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {readModels} from '../../read-models';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failureWithStatus';
import {ViewModel} from './view-model';
import {User} from '../../types';
import {StatusCodes} from 'http-status-codes';
import {sequenceS} from 'fp-ts/lib/Apply';

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (equipmentId: string): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.map(events => ({
        user: E.right(user),
        equipment: pipe(
          equipmentId,
          readModels.equipment.get(events),
          E.fromOption(() =>
            failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
          ),
          E.map(partial => ({...partial, trainers: []}))
        ),
      })),
      TE.chainEitherK(sequenceS(E.Apply))
    );
