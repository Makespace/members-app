import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';

const codec = t.strict({
  id: tt.UUID,
});

type RemoveOwner = t.TypeOf<typeof codec>;

// eslint-disable-next-line unused-imports/no-unused-vars
const process: Command<RemoveOwner>['process'] = input => O.none;

const resource: Command<RemoveOwner>['resource'] = command => ({
  type: 'Area',
  id: command.id,
});

export const removeOwner: Command<RemoveOwner> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
