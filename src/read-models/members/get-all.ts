import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {gravatarHashFromEmail} from './avatar';
import {
  filterByName,
  SubsetOfDomainEvent,
  DomainEvent,
  isEventOfType,
  Member,
  MemberDetails,
  MultipleMemberDetails,
  Actor,
  User,
} from '../../types';
import {pipe} from 'fp-ts/lib/function';

export const pertinentEvents = [
  'MemberNumberLinkedToEmail' as const,
  'SuperUserRevoked' as const,
  'SuperUserDeclared' as const,
  'MemberDetailsUpdated' as const,
  'MemberEmailChanged' as const,
];

const update = (
  state: MultipleMemberDetails,
  event: SubsetOfDomainEvent<typeof pertinentEvents>
): MultipleMemberDetails => {
  const memberNumber = event.memberNumber;
  const details = state.get(memberNumber);
  switch (event.type) {
    case 'MemberNumberLinkedToEmail':
      state.set(memberNumber, {
        emailAddress: event.email,
        gravatarHash: gravatarHashFromEmail(event.email),
        memberNumber,
        name: O.none,
        pronouns: O.none,
        isSuperUser: false,
        prevEmails: [],
      });
      break;
    case 'SuperUserDeclared':
      if (details) {
        details.isSuperUser = true;
      }
      break;
    case 'SuperUserRevoked':
      if (details) {
        details.isSuperUser = false;
      }
      break;
    case 'MemberDetailsUpdated':
      if (details && event.name !== undefined) {
        details.name = O.some(event.name);
      }
      if (details && event.pronouns !== undefined) {
        details.pronouns = O.some(event.pronouns);
      }
      break;
    case 'MemberEmailChanged':
      // Assumes events are in chronological order.
      if (details) {
        details.prevEmails = [...details.prevEmails, details.emailAddress];
        details.emailAddress = event.newEmail;
        details.gravatarHash = gravatarHashFromEmail(event.newEmail);
      }
      break;
  }
  return state;
};

export const getAll = (
  events: ReadonlyArray<DomainEvent>
): ReadonlyArray<Member> =>
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
): MultipleMemberDetails =>
  pipe(events, filterByName(pertinentEvents), RA.reduce(new Map(), update));

export const liftActorOrUser = (actorOrUser: Actor | User) =>
  Actor.is(actorOrUser)
    ? actorOrUser
    : {
        tag: 'user' as const,
        user: actorOrUser,
      };

const redactEmail = (member: MemberDetails): MemberDetails =>
  Object.assign({}, member, {emailAddress: '******'});

// If a given |actor|, with the context of |details| is viewing |member|
// should sensitive details (email) about that member be redacted.
const shouldRedact =
  (actor: Actor) =>
  (details: MultipleMemberDetails) =>
  (member: MemberDetails) => {
    switch (actor.tag) {
      case 'token':
        return false;
      case 'system':
        return false;
      case 'user': {
        const viewingUser = actor.user;
        const viewingMember = details.get(viewingUser.memberNumber);
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

const redactDetailsForActor =
  (actor: Actor) => (details: MultipleMemberDetails) => {
    const needsRedaction = shouldRedact(actor)(details);
    const redactedDetails = new Map();
    for (const [memberNumber, member] of details.entries()) {
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
