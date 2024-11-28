import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {ViewModel} from './view-model';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {readModels} from '../../read-models';

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.filterOrElse(
        readModels.superUsers.is(user.memberNumber),
        failureWithStatus(
          'Only super-users can see this page',
          StatusCodes.FORBIDDEN
        )
      ),
      TE.map(events => ({
        user: user,
        superUsers: readModels.superUsers.getAll()(events),
      }))
    );
