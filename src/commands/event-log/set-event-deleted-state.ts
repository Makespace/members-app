import * as t from 'io-ts';
import {Int} from 'io-ts';
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

const process =
  (deleted: boolean): Command<t.TypeOf<typeof codec>>['process'] =>
  input => {
    if (input.deps === undefined) {
      return TE.left(
        failureWithStatus(
          'Missing dependencies needed to update event deleted state',
          StatusCodes.INTERNAL_SERVER_ERROR
        )()
      );
    }

    return pipe(
      input.deps.setEventDeletedState(input.command.eventIndex as Int, deleted),
      TE.map(() => O.none)
    );
  };

const buildCommand = (deleted: boolean): Command<t.TypeOf<typeof codec>> => ({
  process: process(deleted),
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
});

export const deleteEvent = buildCommand(true);
export const undeleteEvent = buildCommand(false);
