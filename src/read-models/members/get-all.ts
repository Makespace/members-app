import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {
  filterByName,
  SubsetOfDomainEvent,
  DomainEvent,
  isEventOfType,
  Member,
  MemberDetails,
} from '../../types';
import {pipe} from 'fp-ts/lib/function';

type AllMemberDetails = Map<number, MemberDetails>;

export const pertinentEvents = [
  'MemberNumberLinkedToEmail' as const,
  'SuperUserRevoked' as const,
  'SuperUserDeclared' as const,
  'MemberDetailsUpdated' as const,
];

const update = (
  state: AllMemberDetails,
  event: SubsetOfDomainEvent<typeof pertinentEvents>
): AllMemberDetails => {
  const memberNumber = event.memberNumber;
  const details = state.get(memberNumber);
  switch (event.type) {
    case 'MemberNumberLinkedToEmail':
      state.set(memberNumber, {
        email: event.email,
        number: memberNumber,
        name: O.none,
        pronouns: O.none,
        isSuperUser: false,
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
  }
  return state;
};

export const getAll = (
  events: ReadonlyArray<DomainEvent>
): ReadonlyArray<Member> =>
  pipe(
    events,
    RA.filter(isEventOfType('MemberNumberLinkedToEmail')),
    RA.map(event => ({number: event.memberNumber, email: event.email}))
  );

export const getAllDetails = (
  events: ReadonlyArray<DomainEvent>
): AllMemberDetails =>
  pipe(events, filterByName(pertinentEvents), RA.reduce(new Map(), update));
