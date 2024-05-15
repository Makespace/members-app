import {DomainEvent, constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import * as RA from 'fp-ts/ReadonlyArray';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {pipe} from 'fp-ts/lib/function';
import {filterByName} from '../../types/domain-event';
import {resource} from './resource';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  revokedAt: tt.DateFromISOString,
});

export type RevokeSuperUser = t.TypeOf<typeof codec>;

const process = (input: {
  command: RevokeSuperUser;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> =>
  pipe(
    input.events,
    filterByName(['SuperUserDeclared', 'SuperUserRevoked']),
    RA.filter(event => event.memberNumber === input.command.memberNumber),
    RA.last,
    O.match(
      () => O.none,
      event =>
        event.type === 'SuperUserDeclared'
          ? O.some(constructEvent('SuperUserRevoked')(input.command))
          : O.none
    )
  );

export const revoke: Command<RevokeSuperUser> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
