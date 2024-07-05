import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {User} from '../../types/user';
import {ViewModel} from './view-model';
import {readModels} from '../../read-models';
import {StatusCodes} from 'http-status-codes';

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.filterOrElseW(readModels.superUsers.is(user.memberNumber), () =>
        failureWithStatus(
          'You are not authorised to see this page',
          StatusCodes.UNAUTHORIZED
        )()
      ),
      TE.map(events => ({
        failedImports: readModels.members.getFailedImports(events),
        user,
      }))
    );
