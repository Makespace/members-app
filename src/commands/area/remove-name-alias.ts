import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';

// Removes a registered area-name alias. Tickets already bound through it keep
// their area; only future resolution stops using the alias.
const codec = t.strict({
  areaId: tt.UUID,
  alias: tt.NonEmptyString,
});

type RemoveAreaNameAlias = t.TypeOf<typeof codec>;

const process: Command<RemoveAreaNameAlias>['process'] = input =>
  TE.right(O.some(constructEvent('AreaNameAliasRemoved')(input.command)));

export const removeNameAlias: Command<RemoveAreaNameAlias> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
