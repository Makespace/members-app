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
});
type UnDeleteEvent = t.TypeOf<typeof codec>;

const process: Command<UnDeleteEvent>['process'] = input => {
    if (input.deps === undefined) {
      return TE.left(
        failureWithStatus(
          'Missing dependencies needed to update event deleted state',
          StatusCodes.INTERNAL_SERVER_ERROR
        )()
      );
    }

    return pipe(
      input.deps.unDeleteEvent(
        input.command.eventIndex,
      ),
      TE.map(() => O.none)
    );
  };

export const unDeleteEvent: Command<UnDeleteEvent> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
