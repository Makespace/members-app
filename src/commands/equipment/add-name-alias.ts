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

// Registers an alternative name for a piece of equipment - typically a label
// used by the trouble-ticket Google Form that doesn't match the app's
// equipment name. Adding an alias re-binds any Unassigned tickets whose raw
// equipment string matches it (see the projection); re-adding an existing
// alias re-points it to the new equipment.
const codec = t.strict({
  equipmentId: tt.UUID,
  alias: tt.NonEmptyString,
});

type AddEquipmentNameAlias = t.TypeOf<typeof codec>;

const process: Command<AddEquipmentNameAlias>['process'] = input =>
  pipe(
    input.rm.equipment.get(input.command.equipmentId),
    TE.fromOption(
      failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)
    ),
    TE.map(() =>
      O.some(constructEvent('EquipmentNameAliasAdded')(input.command))
    )
  );

export const addNameAlias: Command<AddEquipmentNameAlias> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
