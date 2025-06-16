import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {ViewModel} from './view-model';
import {User} from '../../types';
import {SharedReadModel} from '../../read-models/shared-state';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../../dependencies';

export const constructViewModel =
  (sharedReadModel: SharedReadModel, deps: Dependencies) =>
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
      TE.map(_user => O.fromNullable(deps.conf.TROUBLE_TICKET_SHEET)),
      TE.flatMap(troubleTicketSheetId => {
        if (O.isNone(troubleTicketSheetId)) {
          return TE.left(
            failureWithStatus(
              'Trouble ticket sheet not configured',
              StatusCodes.INTERNAL_SERVER_ERROR
            )()
          );
        }
        return pipe(
          deps.getTroubleTicketData(troubleTicketSheetId.value),
          TE.mapLeft(msg =>
            failureWithStatus(msg, StatusCodes.INTERNAL_SERVER_ERROR)()
          )
        );
      }),
      TE.map(ttd => ({
        troubleTicketData: ttd,
      }))
    );
