import * as RA from 'fp-ts/ReadonlyArray';
import {SubsetOfDomainEvent, filterByName} from '../../types';
import {DomainEvent, EventName, isEventOfType} from '../../types/domain-event';
import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {Member} from './member';
import {FailedLinking} from './failed-linking';

type Area = {
  id: string;
  owners: Set<number>;
};

type State = {
  members: Map<Member['memberNumber'], Member>;
  areas: Map<Area['id'], Area>;
  failedImports: Set<FailedLinking>;
};

const emptyState = (): State => ({
  members: new Map(),
  areas: new Map(),
  failedImports: new Set(),
});

const pertinentEventTypes: Array<EventName> = [
  'MemberNumberLinkedToEmail',
  'MemberDetailsUpdated',
  'AreaCreated',
  'OwnerAdded',
  'OwnerAgreementSigned',
  'LinkingMemberNumberToAnAlreadyUsedEmailAttempted',
];

const handleEvent = (
  state: State,
  event: SubsetOfDomainEvent<typeof pertinentEventTypes>
) => {
  if (isEventOfType('MemberNumberLinkedToEmail')(event)) {
    state.members.set(event.memberNumber, {
      memberNumber: event.memberNumber,
      emailAddress: event.email,
      name: O.none,
      pronouns: O.none,
      agreementSigned: O.none,
      isSuperUser: false,
    });
  }
  if (isEventOfType('MemberDetailsUpdated')(event)) {
    const current = state.members.get(event.memberNumber);
    if (current) {
      const name =
        event.name !== undefined ? O.fromNullable(event.name) : current.name;
      const pronouns =
        event.pronouns !== undefined
          ? O.fromNullable(event.pronouns)
          : current.pronouns;
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
  if (
    isEventOfType('LinkingMemberNumberToAnAlreadyUsedEmailAttempted')(event)
  ) {
    state.failedImports.add({
      memberNumber: event.memberNumber,
      email: event.email,
    });
  }
  return state;
};

export const replayState = (events: ReadonlyArray<DomainEvent>) =>
  pipe(
    events,
    filterByName(pertinentEventTypes),
    RA.reduce(emptyState(), handleEvent)
  );
