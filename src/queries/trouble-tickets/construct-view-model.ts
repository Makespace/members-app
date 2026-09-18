import * as TE from 'fp-ts/TaskEither';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {ViewModel} from './view-model';
import {User} from '../../types';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {SharedReadModel} from '../../read-models/shared-state';
import {DateTime, Duration} from 'luxon';

const TROUBLE_TICKET_DISPLAY_RANGE = Duration.fromObject({month: 6});

export const constructViewModel =
  (sharedReadModel: SharedReadModel) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      sharedReadModel.members.getByMemberNumber(user.memberNumber),
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
      TE.map(() => {
        const cutoff = DateTime.now()
          .minus(TROUBLE_TICKET_DISPLAY_RANGE)
          .toJSDate();
        return {
          tickets: sharedReadModel.troubleTickets
            .getAll()
            .filter(ticket => ticket.submittedAt >= cutoff),
        };
      })
    );
