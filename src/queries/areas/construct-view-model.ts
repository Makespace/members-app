import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {readModels} from '../../read-models';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {ViewModel} from './view-model';
import {StatusCodes} from 'http-status-codes';

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.filterOrElse(
        readModels.superUsers.is(user.memberNumber),
        failureWithStatus(
          'Only super-users can see this page',
          StatusCodes.UNAUTHORIZED
        )
      ),
      TE.map(events => ({
        user: user,
        areas: readModels.areas.getAll(events),
      }))
    );
