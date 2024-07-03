/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {
  DomainEvent,
  EmailAddress,
  SubsetOfDomainEvent,
  filterByName,
} from '../../types';
import {pipe} from 'fp-ts/lib/function';
import {EventName, isEventOfType} from '../../types/domain-event';

type Member = {
  number: number;
  email: EmailAddress;
  name: O.Option<string>;
  pronouns: O.Option<string>;
  agreementSigned: O.Option<Date>;
};

export type AreaOwners = {
  existing: ReadonlyArray<Member>;
  potential: ReadonlyArray<Member>;
};

type Area = {
  id: string;
  owners: Set<number>;
};

type State = {
  members: Map<Member['number'], Member>;
  areas: Map<Area['id'], Area>;
};

const emptyState = (): State => ({
  members: new Map(),
  areas: new Map(),
});

const pertinentEventTypes: Array<EventName> = [
  'MemberNumberLinkedToEmail',
  'MemberDetailsUpdated',
  'AreaCreated',
  'OwnerAdded',
  'OwnerAgreementSigned',
];

const handleEvent = (
  state: State,
  event: SubsetOfDomainEvent<typeof pertinentEventTypes>
) => {
  if (isEventOfType('MemberNumberLinkedToEmail')(event)) {
    state.members.set(event.memberNumber, {
      number: event.memberNumber,
      email: event.email,
      name: O.none,
      pronouns: O.none,
      agreementSigned: O.none,
    });
  }
  if (isEventOfType('MemberDetailsUpdated')(event)) {
    const current = state.members.get(event.memberNumber);
    const name = O.fromNullable(event.name);
    const pronouns = O.fromNullable(event.pronouns);
    if (current) {
      state.members.set(event.memberNumber, {...current, name, pronouns});
    }
  }
  if (isEventOfType('OwnerAgreementSigned')(event)) {
    const current = state.members.get(event.memberNumber);
    if (current) {
      state.members.set(event.memberNumber, {
        ...current,
        agreementSigned: O.some(event.signedAt),
      });
    }
  }
  if (isEventOfType('AreaCreated')(event)) {
    state.areas.set(event.id, {id: event.id, owners: new Set()});
  }
  if (isEventOfType('OwnerAdded')(event)) {
    const current = state.areas.get(event.areaId);
    if (current) {
      state.areas.set(event.areaId, {
        ...current,
        owners: current.owners.add(event.memberNumber),
      });
    }
  }
  return state;
};

export const getPotentialOwners =
  (areaId: string) =>
  (events: ReadonlyArray<DomainEvent>): O.Option<AreaOwners> =>
    pipe(
      events,
      filterByName(pertinentEventTypes),
      RA.reduce(emptyState(), handleEvent),
      O.some,
      O.bind('requestedArea', ({areas}) => O.fromNullable(areas.get(areaId))),
      O.bind('existing', ({members, requestedArea}) =>
        pipe(
          requestedArea.owners,
          owners => Array.from(owners.values()),
          O.traverseArray(memberNumber =>
            O.fromNullable(members.get(memberNumber))
          )
        )
      ),
      O.bind('potential', ({requestedArea, members}) =>
        pipe(
          Array.from(members.values()),
          RA.filter(({number}) => !requestedArea.owners.has(number)),
          O.some
        )
      )
    );

type FailedLinking = {
  memberNumber: number;
  email: string;
};

export const getFailedImports = (
  events: ReadonlyArray<DomainEvent>
): ReadonlyArray<FailedLinking> => [];
