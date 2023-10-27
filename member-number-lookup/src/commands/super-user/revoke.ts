import {DomainEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../../types/command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  revokedAt: tt.DateFromISOString,
});

type RevokeSuperUser = t.TypeOf<typeof codec>;

// eslint-disable-next-line unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars
const process = (input: {
  command: RevokeSuperUser;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> => O.none;

export const revoke: Command<RevokeSuperUser> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
