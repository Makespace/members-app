import {DomainEvent, EventOfType, isEventOfType} from '../../types/domain-event';
import {EmailAddress} from '../../types';
import {normaliseEmailAddress} from '../../read-models/shared-state/normalise-email-address';

type EmailDetails = {
  verified: boolean;
};

type MemberEmailState = {
  memberNumber: number;
  primaryEmailAddress: EmailAddress;
  emails: Map<EmailAddress, EmailDetails>;
};

const ensureMemberState = (
  states: Map<number, MemberEmailState>,
  memberNumber: number,
  primaryEmailAddress: EmailAddress
): MemberEmailState => {
  const existingState = states.get(memberNumber);
  if (existingState !== undefined) {
    return existingState;
  }
  const newState: MemberEmailState = {
    memberNumber,
    primaryEmailAddress,
    emails: new Map(),
  };
  states.set(memberNumber, newState);
  return newState;
};

const addOrUpdateEmail = (
  state: MemberEmailState,
  emailAddress: EmailAddress,
  verified: boolean
) => {
  const existingEmail = state.emails.get(emailAddress);
  state.emails.set(emailAddress, {
    verified: existingEmail?.verified ?? verified,
  });
};

const applyLegacyLinkedEmail = (
  states: Map<number, MemberEmailState>,
  event: EventOfType<'MemberNumberLinkedToEmail'>
) => {
  const emailAddress = normaliseEmailAddress(event.email);
  const state = ensureMemberState(states, event.memberNumber, emailAddress);
  state.primaryEmailAddress = emailAddress;
  addOrUpdateEmail(state, emailAddress, true);
};

const applyEmailAdded = (
  states: Map<number, MemberEmailState>,
  event: EventOfType<'MemberEmailAdded'>
) => {
  const emailAddress = normaliseEmailAddress(event.email);
  const state = states.get(event.memberNumber);
  if (state === undefined) {
    return;
  }
  addOrUpdateEmail(state, emailAddress, false);
};

const applyEmailVerified = (
  states: Map<number, MemberEmailState>,
  event: EventOfType<'MemberEmailVerified'>
) => {
  const emailAddress = normaliseEmailAddress(event.email);
  const state = states.get(event.memberNumber);
  if (state === undefined || !state.emails.has(emailAddress)) {
    return;
  }
  state.emails.set(emailAddress, {verified: true});
};

const applyPrimaryEmailChanged = (
  states: Map<number, MemberEmailState>,
  event: EventOfType<'MemberPrimaryEmailChanged'>
) => {
  const emailAddress = normaliseEmailAddress(event.email);
  const state = states.get(event.memberNumber);
  if (state === undefined || !state.emails.has(emailAddress)) {
    return;
  }
  state.primaryEmailAddress = emailAddress;
};

export const projectMemberEmailStates = (
  events: ReadonlyArray<DomainEvent>
): Map<number, MemberEmailState> => {
  const states = new Map<number, MemberEmailState>();
  events.forEach(event => {
    if (isEventOfType('MemberNumberLinkedToEmail')(event)) {
      applyLegacyLinkedEmail(states, event);
      return;
    }
    if (isEventOfType('MemberEmailAdded')(event)) {
      applyEmailAdded(states, event);
      return;
    }
    if (isEventOfType('MemberEmailVerified')(event)) {
      applyEmailVerified(states, event);
      return;
    }
    if (isEventOfType('MemberPrimaryEmailChanged')(event)) {
      applyPrimaryEmailChanged(states, event);
    }
  });
  return states;
};

export const findMemberNumberByEmail = (
  states: Map<number, MemberEmailState>,
  emailAddress: EmailAddress
): number | undefined => {
  const normalisedEmailAddress = normaliseEmailAddress(emailAddress);
  for (const state of states.values()) {
    if (state.emails.has(normalisedEmailAddress)) {
      return state.memberNumber;
    }
  }
  return undefined;
};
