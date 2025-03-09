import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {ViewModel} from './view-model';

export const constructViewModel =
  (sharedReadModel: Dependencies['sharedReadModel']) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      sharedReadModel.members.get(user.memberNumber),
      TE.fromOption(
        failureWithStatus(
          'You do not have the necessary permission to see this page.',
          StatusCodes.UNAUTHORIZED
        )
      ),
      TE.filterOrElse(
        member => member.isSuperUser,
        () =>
          failureWithStatus(
            'You do not have the necessary permission to see this page.',
            StatusCodes.UNAUTHORIZED
          )()
      ),
      TE.map(() => ({
        dump: sharedReadModel.debug.dump(),
      }))
    );
