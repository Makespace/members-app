import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {EmailAddressCodec} from './email-address';
import {Actor} from './actor';
import {EquipmentCategoryCodec} from './equipment-category';

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
  // red / orange / green sticker category; equipment added before categories
  // existed is red (training-managed), which is what all of it was.
  category: tt.withFallback(EquipmentCategoryCodec, 'red'),
});

// Recategorise existing equipment (e.g. red kit downgraded to orange).
const EquipmentCategoryChanged = defineEvent('EquipmentCategoryChanged', {
  equipmentId: tt.UUID,
  category: EquipmentCategoryCodec,
});

// Some equipment records stand for several identical machines (e.g. three 3D
// printers under one entry). The names are the units a member picks from when
// raising a ticket; an empty list means a single machine.
const EquipmentMachinesSet = defineEvent('EquipmentMachinesSet', {
  equipmentId: tt.UUID,
  machineNames: t.readonlyArray(t.string),
});

// Soft-hide: the equipment and its training history stay in the log/read model,
// but it is treated as obsolete (hidden from members browsing for training).
const EquipmentMarkedObsolete = defineEvent('EquipmentMarkedObsolete', {
  id: tt.UUID,
});

// An alternative name that resolves to a piece of equipment - e.g. the label
// used by the trouble-ticket Google Form ("Laser cutter (Jaws)") for the
// equipment the app calls "Jaws". Used when linking free-text equipment
// references to equipment records; adding an alias re-binds any tickets whose
// raw string matches it and is still unresolved.
const EquipmentNameAliasAdded = defineEvent('EquipmentNameAliasAdded', {
  equipmentId: tt.UUID,
  alias: t.string,
});

const EquipmentNameAliasRemoved = defineEvent('EquipmentNameAliasRemoved', {
  equipmentId: tt.UUID,
  alias: t.string,
});

// Like EquipmentNameAliasAdded, but resolving a freeform label to a whole
// AREA - for tickets about something in an area that has no (or no single)
// equipment record, e.g. "Wi-Fi / Computers / Printer" -> IT Systems. A
// ticket's specific equipment always wins over a direct area when both ever
// apply.
const AreaNameAliasAdded = defineEvent('AreaNameAliasAdded', {
  areaId: tt.UUID,
  alias: t.string,
});

const AreaNameAliasRemoved = defineEvent('AreaNameAliasRemoved', {
  areaId: tt.UUID,
  alias: t.string,
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

const TrainerRemoved = defineEvent('TrainerRemoved', {
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

// The machine's page on equipment.makespace.org. Recorded rather than derived
// from the machine's name: the guide site files things under its own headings,
// and a guessed address that 404s is worse than no link - it goes on a poster
// stuck to the machine. An empty string clears it.
const EquipmentGuideUrlSet = defineEvent('EquipmentGuideUrlSet', {
  equipmentId: tt.UUID,
  guideUrl: t.string,
});

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
  // Old event no longer used.
  'TroubleTicketResponseSubmitted',
  {}
);

// --- Site notifications ---
// Admin-authored banners shown at the top of every page to their target
// audience. The banner content is structured (title/message/link) so it can
// be rendered safely; the optional email body is markdown, converted to HTML
// when the go-live email is sent by the sync worker.
const NotificationCreated = defineEvent('NotificationCreated', {
  id: tt.UUID,
  title: t.string,
  message: t.string,
  // 'action' (orange), 'event' (green), 'info' (blue).
  bannerType: t.keyof({action: null, event: null, info: null}),
  linkUrl: t.union([t.string, t.null]),
  linkLabel: t.union([t.string, t.null]),
  dismissable: t.boolean,
  expiresAt: t.union([tt.DateFromISOString, t.null]),
  // Target audience: every owner, or owners of the listed areas.
  targetAllOwners: t.boolean,
  targetAreaIds: t.readonlyArray(tt.UUID),
  emailMarkdown: t.union([t.string, t.null]),
});

// A member dismissed a dismissable notification for themselves.
const NotificationDismissed = defineEvent('NotificationDismissed', {
  notificationId: tt.UUID,
  memberNumber: t.number,
});

// An admin withdrew a notification before its expiry.
const NotificationRevoked = defineEvent('NotificationRevoked', {
  notificationId: tt.UUID,
});

// The go-live email for a notification has been dispatched (dedup marker,
// committed before sending - prefer a missed email over duplicates).
const NotificationEmailSent = defineEvent('NotificationEmailSent', {
  notificationId: tt.UUID,
});

// --- Mailbox ---
// A manager puts a conversation out of sight, or brings it back. The mailbox
// itself is a cache outside the event log (its bodies are PII); this is the
// curated fact about it that does belong here - opaque Gmail message ids and
// who acted. Every message of the conversation is named, because the
// conversation's own id is its earliest message, which moves as the cache
// window does: any one of these identifies it later.
const MailboxConversationArchived = defineEvent(
  'MailboxConversationArchived',
  {
    gmailMessageIds: t.array(t.string),
  }
);

const MailboxConversationUnarchived = defineEvent(
  'MailboxConversationUnarchived',
  {
    gmailMessageIds: t.array(t.string),
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

// A member's completion of an online training quiz, migrated from (or newly
// scraped from) a Google training sheet. Stores only the raw facts from the
// sheet row - member and equipment resolution happen downstream. `emailProvided`
// is free-form (the sheet field is unvalidated) so may not be a valid email.
// `rowHash` is a stable dedup key so the same row is never imported twice.
const TrainingQuizCompleted = defineEvent('TrainingQuizCompleted', {
  trainingSheetId: t.string,
  completedAt: tt.DateFromISOString,
  memberNumberProvided: t.union([t.number, t.null]),
  emailProvided: t.union([t.string, t.null]),
  score: t.number,
  maxScore: t.number,
  rowHash: t.string,
});

// A trouble ticket submitted via the Google Form, migrated from (or newly
// scraped from) the trouble-ticket sheet cache. Stores only the raw facts from
// the sheet row - member and equipment resolution happen downstream. The
// submitter-provided identity fields are unverified free-form input. `rowHash`
// is a stable dedup key so the same row is never imported twice.
const TroubleTicketCreated = defineEvent('TroubleTicketCreated', {
  id: tt.UUID,
  rowHash: t.string,
  sheetId: t.string,
  submittedAt: tt.DateFromISOString,
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
  // Raised through the app rather than the Google Form: the member picked the
  // equipment from a list, so it needs no name resolution, and they get a
  // confirmation email (which the imported history must never trigger - hence
  // the 'sheet' fallback on every stored event).
  source: tt.withFallback(t.keyof({sheet: null, app: null}), 'sheet'),
  equipmentId: tt.withFallback(t.union([tt.UUID, t.null]), null),
  // Which unit, when the equipment stands for several machines.
  machine: tt.withFallback(t.string, ''),
});

// --- Trouble ticket status workflow ---
// Each transition is its own event so its required context can be enforced by
// the codec (defineEvent uses t.strict - no optional fields). All carry the
// ticketId plus the standard actor/recordedAt, which supply the who/when for
// the ticket's change timeline.

// A trainer assigns themselves to a ticket. Multiple trainers may be assigned;
// the first assignment on a Todo ticket moves it to In Progress.
const TroubleTicketAssigned = defineEvent('TroubleTicketAssigned', {
  ticketId: tt.UUID,
  trainerMemberNumber: t.number,
  // Optional message to the submitter, shown in the notification email and
  // the ticket's change log. '' means none.
  comment: tt.withFallback(t.string, ''),
});

// The ticket is resolved, with a summary of what was done. quiet suppresses
// the notification email - for clearing backlogs of tickets that were
// resolved long ago outside the app.
const TroubleTicketResolved = defineEvent('TroubleTicketResolved', {
  ticketId: tt.UUID,
  summary: t.string,
  quiet: tt.withFallback(t.boolean, false),
});

// The ticket is parked - can't be solved right now.
const TroubleTicketParked = defineEvent('TroubleTicketParked', {
  ticketId: tt.UUID,
  whyParked: t.string,
  pathToResolution: t.string,
  intermediateActions: t.string,
});

// A trainer looked at the ticket but couldn't solve it; they are unassigned so
// another trainer can pick it up.
const TroubleTicketNeedsHelp = defineEvent('TroubleTicketNeedsHelp', {
  ticketId: tt.UUID,
  whatTried: t.string,
  whyDidntWork: t.string,
});

// An owner overrides which equipment a ticket relates to (null re-buckets to
// Unassigned).
const TroubleTicketEquipmentSet = defineEvent('TroubleTicketEquipmentSet', {
  ticketId: tt.UUID,
  equipmentId: t.union([tt.UUID, t.null]),
});

// An owner edits the ticket title (which defaults to the form's "issue" text).
const TroubleTicketTitleEdited = defineEvent('TroubleTicketTitleEdited', {
  ticketId: tt.UUID,
  title: t.string,
});

// Records that change-notification emails have been sent for a specific
// status-change event (identified by its event index), so the notifier doesn't
// send them again.
const TroubleTicketNotificationSent = defineEvent(
  'TroubleTicketNotificationSent',
  {
    ticketId: tt.UUID,
    notifiedEventIndex: t.number,
  }
);

export const events = [
  AreaCreated,
  AreaRemoved,
  AreaEmailUpdated,
  EquipmentAdded,
  EquipmentCategoryChanged,
  EquipmentMachinesSet,
  EquipmentMarkedObsolete,
  EquipmentNameAliasAdded,
  EquipmentNameAliasRemoved,
  AreaNameAliasAdded,
  AreaNameAliasRemoved,
  OwnerAdded,
  OwnerRemoved,
  SuperUserDeclared,
  SuperUserRevoked,
  TrainerAdded,
  TrainerRemoved,
  MemberNumberLinkedToEmail,
  MemberEmailAdded,
  MemberEmailVerificationRequested,
  MemberEmailVerified,
  MemberPrimaryEmailChanged,
  LinkingMemberNumberToAnAlreadyUsedEmailAttempted,
  EquipmentTrainingSheetRegistered,
  EquipmentTrainingSheetRemoved,
  EquipmentGuideUrlSet,
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
  MemberRejoinedWithNewNumber,
  MemberRejoinedWithExistingNumber,
  TrainingStatNotificationSent,
  TrainingQuizCompleted,
  TroubleTicketCreated,
  TroubleTicketAssigned,
  TroubleTicketResolved,
  TroubleTicketParked,
  TroubleTicketNeedsHelp,
  TroubleTicketEquipmentSet,
  TroubleTicketTitleEdited,
  TroubleTicketNotificationSent,
  NotificationCreated,
  NotificationDismissed,
  NotificationRevoked,
  NotificationEmailSent,
  MailboxConversationArchived,
  MailboxConversationUnarchived,
];

export const DomainEvent = t.union([
  AreaCreated.codec,
  AreaRemoved.codec,
  AreaEmailUpdated.codec,
  EquipmentAdded.codec,
  EquipmentCategoryChanged.codec,
  EquipmentMachinesSet.codec,
  EquipmentMarkedObsolete.codec,
  EquipmentNameAliasAdded.codec,
  EquipmentNameAliasRemoved.codec,
  AreaNameAliasAdded.codec,
  AreaNameAliasRemoved.codec,
  OwnerAdded.codec,
  OwnerRemoved.codec,
  SuperUserDeclared.codec,
  SuperUserRevoked.codec,
  TrainerAdded.codec,
  TrainerRemoved.codec,
  MemberNumberLinkedToEmail.codec,
  MemberEmailAdded.codec,
  MemberEmailVerificationRequested.codec,
  MemberEmailVerified.codec,
  MemberPrimaryEmailChanged.codec,
  LinkingMemberNumberToAnAlreadyUsedEmailAttempted.codec,
  EquipmentTrainingSheetRegistered.codec,
  EquipmentTrainingSheetRemoved.codec,
  EquipmentGuideUrlSet.codec,
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
  MemberRejoinedWithNewNumber.codec,
  MemberRejoinedWithExistingNumber.codec,
  TrainingStatNotificationSent.codec,
  TrainingQuizCompleted.codec,
  TroubleTicketCreated.codec,
  TroubleTicketAssigned.codec,
  TroubleTicketResolved.codec,
  TroubleTicketParked.codec,
  TroubleTicketNeedsHelp.codec,
  TroubleTicketEquipmentSet.codec,
  TroubleTicketTitleEdited.codec,
  TroubleTicketNotificationSent.codec,
  NotificationCreated.codec,
  NotificationDismissed.codec,
  NotificationRevoked.codec,
  NotificationEmailSent.codec,
  MailboxConversationArchived.codec,
  MailboxConversationUnarchived.codec,
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
