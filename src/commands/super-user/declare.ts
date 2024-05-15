import {DomainEvent, constructEvent} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {filterByName} from '../../types/domain-event';
import {resource} from './resource';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  declaredAt: tt.DateFromISOString,
});

export type DeclareSuperUserCommand = t.TypeOf<typeof codec>;

const process = (input: {
  command: DeclareSuperUserCommand;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> =>
  pipe(
    input.events,
    filterByName(['SuperUserDeclared', 'SuperUserRevoked']),
    RA.filter(event => event.memberNumber === input.command.memberNumber),
    RA.last,
    O.match(
      () => O.some(constructEvent('SuperUserDeclared')(input.command)),
      event =>
        event.type === 'SuperUserRevoked'
          ? O.some(constructEvent('SuperUserDeclared')(input.command))
          : O.none
    )
  );

export const declare: Command<DeclareSuperUserCommand> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
