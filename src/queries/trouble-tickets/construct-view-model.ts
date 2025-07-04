import * as TE from 'fp-ts/TaskEither';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {ViewModel} from './view-model';
import {User} from '../../types';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../../dependencies';
import {SharedReadModel} from '../../read-models/shared-state';
import {DateTime, Duration} from 'luxon';
import * as O from 'fp-ts/Option';

const TROUBLE_TICKET_DISPLAY_RANGE = Duration.fromObject({month: 6});

export const constructViewModel =
  (
    sharedReadModel: SharedReadModel,
    getTroubleTicketData: Dependencies['getTroubleTicketData']
  ) =>
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
      TE.flatMap(_user =>
        pipe(
          getTroubleTicketData(
            O.some(
              DateTime.now().minus(TROUBLE_TICKET_DISPLAY_RANGE).toJSDate()
            )
          ),
          TE.mapLeft(msg =>
            failureWithStatus(msg, StatusCodes.INTERNAL_SERVER_ERROR)()
          )
        )
      ),
      TE.map(ttd => ({
        troubleTicketData: ttd,
      }))
    );
