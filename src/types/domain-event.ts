import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {EmailAddressCodec} from './email-address';
import {Actor} from './actor';

const defineEvent = <A extends string, T extends t.Props>(
  type: A,
  payload: T
) => {
  return {
    type,
    codec: eventCodec(type, payload),
  };
};

const eventCodec = <A extends string, T extends t.Props>(
  type: A,
  payload: T
): t.ExactC<
  t.TypeC<
    T & {
      type: t.LiteralC<A>;
      actor: typeof Actor;
      recordedAt: tt.DateFromISOStringC;
    }
  >
> =>
  t.strict({
    ...payload,
    type: t.literal(type),
    actor: Actor,
    recordedAt: tt.DateFromISOString,
  });

const AreaCreated = defineEvent('AreaCreated', {
  name: t.string,
  id: tt.UUID,
});

const AreaRemoved = defineEvent('AreaRemoved', {
  id: tt.UUID,
});

const AreaEmailUpdated = defineEvent('AreaEmailUpdated', {
  id: tt.UUID,
  email: t.union([EmailAddressCodec, t.null]),
});

const EquipmentAdded = defineEvent('EquipmentAdded', {
  name: t.string,
  id: tt.UUID,
  areaId: tt.UUID,
});

const OwnerAdded = defineEvent('OwnerAdded', {
  areaId: tt.UUID,
  memberNumber: t.number,
});

const OwnerRemoved = defineEvent('OwnerRemoved', {
  areaId: tt.UUID,
  memberNumber: t.number,
});

const SuperUserDeclared = defineEvent('SuperUserDeclared', {
  memberNumber: t.number,
});

const SuperUserRevoked = defineEvent('SuperUserRevoked', {
  memberNumber: t.number,
});

const TrainerAdded = defineEvent('TrainerAdded', {
  memberNumber: t.number,
  equipmentId: tt.UUID,
});

const MemberNumberLinkedToEmail = defineEvent('MemberNumberLinkedToEmail', {
  memberNumber: t.number,
  email: EmailAddressCodec,
  name: tt.withFallback(t.union([t.string, t.undefined]), undefined),
  formOfAddress: tt.withFallback(t.union([t.string, t.undefined]), undefined),
});

const MemberEmailAdded = defineEvent('MemberEmailAdded', {
  memberNumber: t.number,
  email: EmailAddressCodec,
});

const MemberEmailVerificationRequested = defineEvent(
  'MemberEmailVerificationRequested',
  {
    memberNumber: t.number,
    email: EmailAddressCodec,
  }
);

const MemberEmailVerified = defineEvent('MemberEmailVerified', {
  memberNumber: t.number,
  email: EmailAddressCodec,
});

const MemberPrimaryEmailChanged = defineEvent('MemberPrimaryEmailChanged', {
  memberNumber: t.number,
  email: EmailAddressCodec,
});

const LinkingMemberNumberToAnAlreadyUsedEmailAttempted = defineEvent(
  'LinkingMemberNumberToAnAlreadyUsedEmailAttempted',
  {
    memberNumber: t.number,
    email: EmailAddressCodec,
  }
);

const EquipmentTrainingSheetRegistered = defineEvent(
  'EquipmentTrainingSheetRegistered',
  {
    equipmentId: tt.UUID,
    trainingSheetId: t.string,
  }
);

const EquipmentTrainingSheetRemoved = defineEvent(
  'EquipmentTrainingSheetRemoved',
  {
    equipmentId: tt.UUID,
  }
);

const EquipmentTrainingQuizResult = defineEvent(
  // Old event no longer used.
  'EquipmentTrainingQuizResult',
  {}
);
const EquipmentTrainingQuizSync = defineEvent('EquipmentTrainingQuizSync', {}); // Old event no longer used.
const EquipmentTrainingQuizEmailUpdated = defineEvent(
  // Old event no longer used.
  'EquipmentTrainingQuizEmailUpdated',
  {}
);
const EquipmentTrainingQuizMemberNumberUpdated = defineEvent(
  // Old event no longer used.
  'EquipmentTrainingQuizMemberNumberUpdated',
  {}
);

const TroubleTicketResponseSubmitted = defineEvent(
  // Old event no longer used. Kept registered (with an empty payload) so historical
  // events of this type still decode - see the constructEvent note below.
  'TroubleTicketResponseSubmitted',
  {}
);

// A trouble ticket raised via the Google Form, brought into the event timeline.
// Carries the raw, unverified facts of the form submission only. The historical
// submission time rides in `submittedAt` (the read model orders by this); `recordedAt`
// stays the append time as usual. `rowHash` is the dedup key against re-ingesting the
// same sheet row (see src/trouble-tickets/row-hash.ts).
const TroubleTicketCreated = defineEvent('TroubleTicketCreated', {
  id: tt.UUID,
  rowHash: t.string,
  sheetId: t.string,
  submittedAt: tt.DateFromISOString,
  // Submitter-provided identity - not trusted/verified, may be absent.
  submittedMemberNumber: t.union([t.number, t.null]),
  submittedEmail: t.union([t.string, t.null]),
  submittedName: t.union([t.string, t.null]),
  submittedEquipment: t.union([t.string, t.null]),
  // Parsed free-text answers, defaulted to '' when missing.
  otherEquipmentDetail: t.string,
  status: t.string,
  attempting: t.string,
  issue: t.string,
  steps: t.string,
});

// --- Trouble ticket status workflow ---
// Each transition is its own event so its required context can be enforced by the codec
// (defineEvent uses t.strict - no optional fields). All carry the ticketId plus the
// standard actor/recordedAt, which supply the who/when for the ticket's change timeline.

// A trainer assigns themselves to a ticket. Multiple trainers may be assigned; the first
// assignment on a Todo ticket moves it to In Progress.
const TroubleTicketAssigned = defineEvent('TroubleTicketAssigned', {
  ticketId: tt.UUID,
  trainerMemberNumber: t.number,
});

// The ticket is resolved, with a summary of what was done.
const TroubleTicketResolved = defineEvent('TroubleTicketResolved', {
  ticketId: tt.UUID,
  summary: t.string,
});

// The ticket is parked - can't be solved right now.
const TroubleTicketParked = defineEvent('TroubleTicketParked', {
  ticketId: tt.UUID,
  whyParked: t.string,
  pathToResolution: t.string,
  intermediateActions: t.string,
});

// A trainer looked at the ticket but couldn't solve it; they are unassigned so another
// trainer can pick it up.
const TroubleTicketNeedsHelp = defineEvent('TroubleTicketNeedsHelp', {
  ticketId: tt.UUID,
  whatTried: t.string,
  whyDidntWork: t.string,
});

// An owner overrides which equipment a ticket relates to (null re-buckets to Unassigned).
const TroubleTicketEquipmentSet = defineEvent('TroubleTicketEquipmentSet', {
  ticketId: tt.UUID,
  equipmentId: t.union([tt.UUID, t.null]),
});

// An owner edits the ticket title (which defaults to the form's "issue" text).
const TroubleTicketTitleEdited = defineEvent('TroubleTicketTitleEdited', {
  ticketId: tt.UUID,
  title: t.string,
});

// Records that change-notification emails have been sent for a specific status-change
// event (identified by its event index), so the notifier doesn't send them again.
const TroubleTicketNotificationSent = defineEvent(
  'TroubleTicketNotificationSent',
  {
    ticketId: tt.UUID,
    notifiedEventIndex: t.number,
  }
);

const MemberDetailsUpdated = defineEvent('MemberDetailsUpdated', {
  memberNumber: t.number,
  name: t.union([t.string, t.undefined]),
  formOfAddress: t.union([t.string, t.undefined]),
});

const OwnerAgreementSigned = defineEvent('OwnerAgreementSigned', {
  memberNumber: t.number,
  signedAt: tt.DateFromISOString,
});

const MemberTrainedOnEquipment = defineEvent('MemberTrainedOnEquipment', {
  equipmentId: tt.UUID,
  memberNumber: t.number,
  trainedByMemberNumber: t.union([t.number, t.null]), // Null to indicate system.
  legacyImport: tt.withFallback(t.boolean, false),
});

// User impersonation version of MemberTrainedOnEquipment
const MemberTrainedOnEquipmentBy = defineEvent('MemberTrainedOnEquipmentBy', {
  equipmentId: tt.UUID,
  memberNumber: t.number,
  trainedByMemberNumber: t.number, // Cannot be by system.
  trainedAt: tt.DateFromISOString,
  markedTrainedBy: t.number, // The admin or trainer who marked the user as trained. Cannot be system.
});

const RevokeTrainedOnEquipment = defineEvent('RevokeTrainedOnEquipment', {
  equipmentId: tt.UUID,
  memberNumber: t.number,
  revokedByMemberNumber: t.union([t.number, t.null]), // Null to indicate system.
});

// Deprecated in favour of the recurly cache tables.
// const RecurlySubscriptionUpdated = defineEvent('RecurlySubscriptionUpdated', {
//   email: EmailAddressCodec,
//   hasActiveSubscription: t.boolean,
//   hasPausedSubscription: t.boolean,
//   hasFutureSubscription: t.boolean,
//   hasCanceledSubscription: t.boolean,
//   hasPastDueInvoice: t.boolean,
// });

const MemberRejoinedWithNewNumber = defineEvent('MemberRejoinedWithNewNumber', {
  oldMemberNumber: t.number,
  newMemberNumber: t.number,
});

const MemberRejoinedWithExistingNumber = defineEvent(
  'MemberRejoinedWithExistingNumber',
  {
    memberNumber: t.number,
  }
);

const TrainingStatNotificationSent = defineEvent(
  'TrainingStatNotificationSent',
  {
    toMemberNumber: t.number,
    toMemberEmail: t.string,
  }
);

export const events = [
  AreaCreated,
  AreaRemoved,
  AreaEmailUpdated,
  EquipmentAdded,
  OwnerAdded,
  OwnerRemoved,
  SuperUserDeclared,
  SuperUserRevoked,
  TrainerAdded,
  MemberNumberLinkedToEmail,
  MemberEmailAdded,
  MemberEmailVerificationRequested,
  MemberEmailVerified,
  MemberPrimaryEmailChanged,
  LinkingMemberNumberToAnAlreadyUsedEmailAttempted,
  EquipmentTrainingSheetRegistered,
  EquipmentTrainingSheetRemoved,
  EquipmentTrainingQuizResult,
  EquipmentTrainingQuizSync,
  MemberDetailsUpdated,
  OwnerAgreementSigned,
  MemberTrainedOnEquipment,
  MemberTrainedOnEquipmentBy,
  RevokeTrainedOnEquipment,
  EquipmentTrainingQuizMemberNumberUpdated,
  EquipmentTrainingQuizEmailUpdated,
  TroubleTicketResponseSubmitted,
  TroubleTicketCreated,
  TroubleTicketAssigned,
  TroubleTicketResolved,
  TroubleTicketParked,
  TroubleTicketNeedsHelp,
  TroubleTicketEquipmentSet,
  TroubleTicketTitleEdited,
  TroubleTicketNotificationSent,
  MemberRejoinedWithNewNumber,
  MemberRejoinedWithExistingNumber,
  TrainingStatNotificationSent,
];

export const DomainEvent = t.union([
  AreaCreated.codec,
  AreaRemoved.codec,
  AreaEmailUpdated.codec,
  EquipmentAdded.codec,
  OwnerAdded.codec,
  OwnerRemoved.codec,
  SuperUserDeclared.codec,
  SuperUserRevoked.codec,
  TrainerAdded.codec,
  MemberNumberLinkedToEmail.codec,
  MemberEmailAdded.codec,
  MemberEmailVerificationRequested.codec,
  MemberEmailVerified.codec,
  MemberPrimaryEmailChanged.codec,
  LinkingMemberNumberToAnAlreadyUsedEmailAttempted.codec,
  EquipmentTrainingSheetRegistered.codec,
  EquipmentTrainingSheetRemoved.codec,
  EquipmentTrainingQuizResult.codec,
  EquipmentTrainingQuizSync.codec,
  MemberDetailsUpdated.codec,
  OwnerAgreementSigned.codec,
  MemberTrainedOnEquipment.codec,
  MemberTrainedOnEquipmentBy.codec,
  RevokeTrainedOnEquipment.codec,
  EquipmentTrainingQuizMemberNumberUpdated.codec,
  EquipmentTrainingQuizEmailUpdated.codec,
  TroubleTicketResponseSubmitted.codec,
  TroubleTicketCreated.codec,
  TroubleTicketAssigned.codec,
  TroubleTicketResolved.codec,
  TroubleTicketParked.codec,
  TroubleTicketNeedsHelp.codec,
  TroubleTicketEquipmentSet.codec,
  TroubleTicketTitleEdited.codec,
  TroubleTicketNotificationSent.codec,
  MemberRejoinedWithNewNumber.codec,
  MemberRejoinedWithExistingNumber.codec,
  TrainingStatNotificationSent.codec,
]);

export const StoredDomainEvent = t.intersection([
  DomainEvent,
  t.strict({
    event_index: t.Int,
    event_id: tt.UUID,
  }),
  t.union(
    [
      t.strict({
        deletedAt: tt.DateFromNumber,
        deleteReason: t.string,
        markDeletedByMemberNumber: t.Int,
      }),
      t.strict({
        deletedAt: t.null,
        deleteReason: t.null,
        markDeletedByMemberNumber: t.null,
      })
    ]
  )
]);

export type DomainEvent = t.TypeOf<typeof DomainEvent>;
export type StoredDomainEvent = t.TypeOf<typeof StoredDomainEvent>;
export type DeletedStoredDomainEvent = StoredDomainEvent & {deletedAt: Date};

export type EventName = DomainEvent['type'];

export type EventOfType<T extends EventName> = DomainEvent & {type: T};
export type StoredEventOfType<T extends EventName> = StoredDomainEvent & {
  type: T;
};

export const isEventOfType =
  <T extends EventName>(name: T) =>
  (event: DomainEvent): event is EventOfType<T> =>
    event.type === name;

type EventBase<T> = {type: T; actor: Actor; recordedAt: Date};

type EventSpecificFields<T extends EventName> = Omit<
  EventOfType<T>,
  'type' | 'actor' | 'recordedAt'
>;

// You must use this for constructing events because it means that if ever completely
// remove an event its easy to find where it needs to be deleted from within the code.
//
// We might remove an event if its not longer being produced and doesn't appear in the database
// anymore but generally we wouldn't delete an event immediately after we stop producing it
// so that read models can still use it for historical context.
export const constructEvent =
  <T extends EventName, A extends EventSpecificFields<T> & {actor: Actor}>(
    type: T
  ) =>
  (args: A): EventBase<T> & A => ({
    type,
    recordedAt: new Date(),
    ...args,
  });
