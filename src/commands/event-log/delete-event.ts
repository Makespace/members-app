import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {failureWithStatus} from '../../types/failure-with-status';

const codec = t.strict({
  eventIndex: tt.IntFromString,
  deleteReason: t.string,
  markDeletedByMemberNumber: t.Int,
});
type DeleteEvent = t.TypeOf<typeof codec>;

const process: Command<DeleteEvent>['process'] = input => {
    if (input.deps === undefined) {
      return TE.left(
        failureWithStatus(
          'Missing dependencies needed to update event deleted state',
          StatusCodes.INTERNAL_SERVER_ERROR
        )()
      );
    }

    return pipe(
      input.deps.deleteEvent(
        input.command.eventIndex,
        input.command.deleteReason,
        input.command.markDeletedByMemberNumber
      ),
      TE.map(() => O.none)
    );
  };

export const deleteEvent: Command<DeleteEvent> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
