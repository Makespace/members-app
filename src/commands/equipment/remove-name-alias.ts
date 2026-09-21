import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';

// Removes a registered equipment-name alias. Tickets already bound through it
// keep their equipment; only future resolution stops using the alias.
const codec = t.strict({
  equipmentId: tt.UUID,
  alias: tt.NonEmptyString,
});

type RemoveEquipmentNameAlias = t.TypeOf<typeof codec>;

const process: Command<RemoveEquipmentNameAlias>['process'] = input =>
  TE.right(
    O.some(constructEvent('EquipmentNameAliasRemoved')(input.command))
  );

export const removeNameAlias: Command<RemoveEquipmentNameAlias> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
