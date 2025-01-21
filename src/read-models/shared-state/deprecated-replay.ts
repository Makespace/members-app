/* eslint-disable unused-imports/no-unused-vars */
import * as RA from 'fp-ts/ReadonlyArray';
import {SubsetOfDomainEvent, filterByName} from '../../types';
import {DomainEvent, EventName, isEventOfType} from '../../types/domain-event';
import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {gravatarHashFromEmail} from '../members/avatar';
import {State, emptyState} from './state';

const pertinentEventTypes: Array<EventName> = [
  'MemberNumberLinkedToEmail',
  'MemberDetailsUpdated',
  'MemberEmailChanged',
  'AreaCreated',
  'OwnerAdded',
  'OwnerAgreementSigned',
  'LinkingMemberNumberToAnAlreadyUsedEmailAttempted',
  'SuperUserDeclared',
  'SuperUserRevoked',
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
      formOfAddress: O.none,
      agreementSigned: O.none,
      isSuperUser: false,
      prevEmails: [],
      gravatarHash: gravatarHashFromEmail(event.email),
      trainedOn: [],
    });
  }
  if (isEventOfType('MemberDetailsUpdated')(event)) {
    const current = state.members.get(event.memberNumber);
    if (current) {
      const name =
        event.name !== undefined ? O.fromNullable(event.name) : current.name;
      const formOfAddress =
        event.formOfAddress !== undefined
          ? O.fromNullable(event.formOfAddress)
          : current.formOfAddress;
      state.members.set(event.memberNumber, {...current, name, formOfAddress});
    }
  }
  if (isEventOfType('MemberEmailChanged')(event)) {
    const current = state.members.get(event.memberNumber);
    if (current) {
      current.prevEmails = [...current.prevEmails, current.emailAddress];
      current.emailAddress = event.newEmail;
      current.gravatarHash = gravatarHashFromEmail(event.newEmail);
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
  if (isEventOfType('SuperUserDeclared')(event)) {
    const current = state.members.get(event.memberNumber);
    if (current) {
      current.isSuperUser = true;
    }
  }
  if (isEventOfType('SuperUserRevoked')(event)) {
    const current = state.members.get(event.memberNumber);
    if (current) {
      current.isSuperUser = false;
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
