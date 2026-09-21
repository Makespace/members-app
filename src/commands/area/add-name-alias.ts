import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {failureWithStatus} from '../../types/failure-with-status';

// Registers an alternative name that resolves to a whole AREA - for trouble
// tickets about something in an area with no single equipment record (e.g.
// "Wi-Fi / Computers / Printer" -> IT Systems). Adding one re-binds any fully
// unresolved tickets whose raw equipment string matches; a ticket's specific
// equipment always wins over a direct area.
const codec = t.strict({
  areaId: tt.UUID,
  alias: tt.NonEmptyString,
});

type AddAreaNameAlias = t.TypeOf<typeof codec>;

const process: Command<AddAreaNameAlias>['process'] = input =>
  pipe(
    input.rm.area.get(input.command.areaId),
    TE.fromOption(failureWithStatus('No such area', StatusCodes.NOT_FOUND)),
    TE.map(() => O.some(constructEvent('AreaNameAliasAdded')(input.command)))
  );

export const addNameAlias: Command<AddAreaNameAlias> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
