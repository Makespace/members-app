import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Actor} from '../types/actor';
import {DomainEvent, filterByName} from '../types';

export const isAdminOrSuperUser = (input: {
  actor: Actor;
  events: ReadonlyArray<DomainEvent>;
}) => {
  const {actor, events} = input;
  switch (actor.tag) {
    case 'token':
      return actor.token === 'admin';
    case 'user':
      return pipe(
        events,
        filterByName(['SuperUserDeclared', 'SuperUserRevoked']),
        RA.filter(event => event.memberNumber === actor.user.memberNumber),
        RA.last,
        O.match(
          () => false,
          e => e.type === 'SuperUserDeclared'
        )
      );
    default:
      return false;
  }
};
