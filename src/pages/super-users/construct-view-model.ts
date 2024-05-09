import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {ViewModel} from './view-model';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {queries} from '../../queries';

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.filterOrElse(
        queries.superUsers.is(user.memberNumber),
        failureWithStatus(
          'Only super-users can see this page',
          StatusCodes.UNAUTHORIZED
        )
      ),
      TE.map(events => ({
        user: user,
        superUsers: queries.superUsers.getAll()(events),
      }))
    );
