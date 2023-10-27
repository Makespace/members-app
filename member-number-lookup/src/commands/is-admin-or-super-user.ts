import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {Actor} from '../types/actor';
import {DomainEvent, isEventOfType} from '../types';

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
        RA.filter(isEventOfType('SuperUserDeclared')),
        RA.some(event => event.memberNumber === actor.user.memberNumber)
      );
    default:
      return false;
  }
};
