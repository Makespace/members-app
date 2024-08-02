import * as RA from 'fp-ts/ReadonlyArray';
import {DomainEvent, isEventOfType, Actor, User} from '../../types';
import {pipe} from 'fp-ts/lib/function';
import {Member, MultipleMembers} from './return-types';
import {replayState} from '../shared-state';

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

const redactEmail = (member: Member): Member =>
  Object.assign({}, member, {emailAddress: '******'});

// If a given |actor|, with the context of |details| is viewing |member|
// should sensitive details (email) about that member be redacted.
const shouldRedact =
  (actor: Actor) => (members: MultipleMembers) => (member: Member) => {
    switch (actor.tag) {
      case 'token':
        return false;
      case 'system':
        return false;
      case 'user': {
        const viewingUser = actor.user;
        const viewingMember = members.get(viewingUser.memberNumber);
        if (viewingMember !== undefined && viewingMember.isSuperUser) {
          return false;
        }
        if (viewingUser.memberNumber === member.memberNumber) {
          return false;
        }
        return true;
      }
    }
  };

const redactDetailsForActor = (actor: Actor) => (members: MultipleMembers) => {
  const needsRedaction = shouldRedact(actor)(members);
  const redactedDetails = new Map();
  for (const [memberNumber, member] of members.entries()) {
    if (needsRedaction(member)) {
      redactedDetails.set(memberNumber, redactEmail(member));
    } else {
      redactedDetails.set(memberNumber, member);
    }
  }
  return redactedDetails;
};

export const getAllDetailsAsActor =
  (actorOrUser: Actor | User) => (events: ReadonlyArray<DomainEvent>) =>
    pipe(
      events,
      getAllDetails,
      redactDetailsForActor(liftActorOrUser(actorOrUser))
    );
