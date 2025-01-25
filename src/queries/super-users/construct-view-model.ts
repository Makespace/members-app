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
import {membersTable} from '../../read-models/shared-state/state';
import {eq} from 'drizzle-orm';

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
      TE.map(() => ({
        user: user,
        superUsers: deps.sharedReadModel.db
          .select()
          .from(membersTable)
          .where(eq(membersTable.isSuperUser, true))
          .all(),
      }))
    );
