import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {
  filterByName,
  SubsetOfDomainEvent,
  DomainEvent,
  isEventOfType,
  Member,
  MultipleMemberDetails,
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
        details.prevEmails.push(details.emailAddress);
        details.emailAddress = event.newEmail;
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
