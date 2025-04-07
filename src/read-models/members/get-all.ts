import * as RA from 'fp-ts/ReadonlyArray';
import {DomainEvent, isEventOfType, Actor, User} from '../../types';
import {pipe} from 'fp-ts/lib/function';

export const getAll = (
  events: ReadonlyArray<DomainEvent>
): ReadonlyArray<User> =>
  pipe(
    events,
    RA.filter(isEventOfType('MemberNumberLinkedToEmail')),
    RA.map(event => ({
      memberNumber: event.memberNumber,
      emailAddress: event.email,
    }))
  );

export const liftActorOrUser = (actorOrUser: Actor | User) =>
  Actor.is(actorOrUser)
    ? actorOrUser
    : {
        tag: 'user' as const,
        user: actorOrUser,
      };
