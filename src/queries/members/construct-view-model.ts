import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failureWithStatus';
import {isEventOfType} from '../../types/domain-event';
import {User} from '../../types/user';
import {ViewModel} from './view-model';
import {readModels} from '../../read-models';
import {StatusCodes} from 'http-status-codes';

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.filterOrElse(readModels.superUsers.is(user.memberNumber), () =>
        failureWithStatus(
          'You do not have the necessary permission to see this page.',
          StatusCodes.UNAUTHORIZED
        )()
      ),
      TE.map(RA.filter(isEventOfType('MemberNumberLinkedToEmail'))),
      TE.map(members => ({
        members,
      }))
    );
