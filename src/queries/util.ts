import {pipe} from 'fp-ts/lib/function';
import {SharedReadModel} from '../read-models/shared-state';
import {failureWithStatus} from '../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import * as TE from 'fp-ts/TaskEither';
import {User} from '../types';

export const mustBeSuperuser = (sharedReadModel: SharedReadModel, user: User) =>
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
    )
  );
