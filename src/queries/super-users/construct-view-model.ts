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
import {membersTable} from '../../read-models/shared-state/state';
import {eq} from 'drizzle-orm';

export const constructViewModel =
  (sharedReadModel: Dependencies['sharedReadModel']) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      sharedReadModel.members.get(user.memberNumber),
      TE.fromOption(
        failureWithStatus(
          'Cannot find sufficent information about you to determine if you can access this page',
          StatusCodes.UNAUTHORIZED
        )
      ),
      TE.filterOrElse(
        loggedInMember => loggedInMember.isSuperUser,
        () =>
          failureWithStatus(
            'Only super-users can see this page',
            StatusCodes.FORBIDDEN
          )()
      ),
      TE.map(() => ({
        user: user,
        superUsers: sharedReadModel.db
          .select()
          .from(membersTable)
          .where(eq(membersTable.isSuperUser, true))
          .all(),
      }))
    );
