import {DomainEvent, EventOfType, isEventOfType} from '../../types/domain-event';
import {EmailAddress} from '../../types';
import {normaliseEmailAddress} from '../../read-models/shared-state/normalise-email-address';

export const SEND_EMAIL_VERIFICATION_COOLDOWN_MS = 10 * 60 * 1000;

type EmailDetails = {
  verified: boolean;
  verificationLastSent: Date | undefined;
};

type MemberEmailState = {
  memberNumber: number;
  primaryEmailAddress: EmailAddress;
  emails: Record<EmailAddress, EmailDetails>;
};

const applyLegacyLinkedEmail = (
  states: Map<number, MemberEmailState>,
  event: EventOfType<'MemberNumberLinkedToEmail'>
) => {
  const emailAddress = normaliseEmailAddress(event.email);
  const state = states.get(event.memberNumber);
  if (state) {
    state.primaryEmailAddress = emailAddress;
    return;
  }
  states.set(event.memberNumber, {
    memberNumber: event.memberNumber,
    primaryEmailAddress: event.email,
    emails: {
      [emailAddress]: {
        verified: true,
        verificationLastSent: undefined,
      }
    }
  });

};

const applyEmailAdded = (
  states: Map<number, MemberEmailState>,
  event: EventOfType<'MemberEmailAdded'>
) => {
  const emailAddress = normaliseEmailAddress(event.email);
  const state = states.get(event.memberNumber);
  if (state === undefined || state.emails[emailAddress]) {
    return;
  }
  state.emails[emailAddress] = {
    verificationLastSent: undefined,
    verified: false,
  };
};

const applyEmailVerified = (
  states: Map<number, MemberEmailState>,
  event: EventOfType<'MemberEmailVerified'>
) => {
  const emailAddress = normaliseEmailAddress(event.email);
  const state = states.get(event.memberNumber);
  if (!state) {
    return;
  }
  const emailInfo = state.emails[emailAddress];
  if (!emailInfo) {
    return;
  }
  emailInfo.verified = true;
};

const applyEmailVerificationRequested = (
  states: Map<number, MemberEmailState>,
  event: EventOfType<'MemberEmailVerificationRequested'>
) => {
  const emailAddress = normaliseEmailAddress(event.email);
  const state = states.get(event.memberNumber);
  if (!state) {
    return;
  }
  const emailInfo = state.emails[emailAddress];
  if (!emailInfo) {
    return;
  }
  if (!emailInfo.verificationLastSent || emailInfo.verificationLastSent.getTime() < event.recordedAt.getTime()) {
    emailInfo.verificationLastSent = event.recordedAt;
    return;
  }
};

const applyPrimaryEmailChanged = (
  states: Map<number, MemberEmailState>,
  event: EventOfType<'MemberPrimaryEmailChanged'>
) => {
  const emailAddress = normaliseEmailAddress(event.email);
  const state = states.get(event.memberNumber);
  if (state === undefined || !state.emails[emailAddress]) {
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
      return;
    }
    if (isEventOfType('MemberEmailVerificationRequested')(event)) {
      applyEmailVerificationRequested(states, event);
      return;
    }
  });
  return states;
};
