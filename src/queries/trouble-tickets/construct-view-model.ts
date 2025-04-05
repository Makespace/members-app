import * as TE from 'fp-ts/TaskEither';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {ViewModel} from './view-model';
import {User} from '../../types';
import {SharedReadModel} from '../../read-models/shared-state';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';

export const constructViewModel =
  (sharedReadModel: SharedReadModel) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      sharedReadModel.members.get(user.memberNumber),
      TE.fromOption(
        failureWithStatus(
          'Only super-users can see this page',
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
      TE.map(_user => {
        return {
          troubleTicketData: sharedReadModel.troubleTickets.getAll(),
        };
      })
    );
