import * as RA from 'fp-ts/ReadonlyArray';
import {DomainEvent, isEventOfType, Actor, User} from '../../types';
import {pipe} from 'fp-ts/lib/function';
import {MultipleMembers} from './return-types';
import {replayState} from '../shared-state';
import {redactDetailsForActor} from './redact';

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

export const getAllDetails = (
  events: ReadonlyArray<DomainEvent>
): MultipleMembers => pipe(events, replayState, state => state.members);

export const liftActorOrUser = (actorOrUser: Actor | User) =>
  Actor.is(actorOrUser)
    ? actorOrUser
    : {
        tag: 'user' as const,
        user: actorOrUser,
      };

export const getAllDetailsAsActor =
  (actorOrUser: Actor | User) => (events: ReadonlyArray<DomainEvent>) =>
    pipe(
      events,
      getAllDetails,
      redactDetailsForActor(liftActorOrUser(actorOrUser))
    );
