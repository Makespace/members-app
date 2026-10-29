import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {EmailAddressCodec} from './email-address';
import {Actor} from './actor';
import {EquipmentCategoryCodec} from './equipment-category';
import {MailboxArchiveReason} from './mailbox-archive-reason';
import {
  PurchaseApprovalCodec,
  PurchaseRequestOutcomeCodec,
} from './purchase-request-outcome';
import {ReminderStage} from '../owner-agreement/reminder-stage';
import {PurchaseCodec} from '../purchasing/purchases';
import {ProposalCodec} from '../purchasing/proposal';
import {RecordedSpendKindCodec} from './recorded-spend-kind';

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

// An area's own groupings for its equipment (e.g. Bike Space's "Wheels" or
// "Bottom brackets"), so a long list can be browsed in sections. Unrelated to
// the red/orange/green sticker category above; areas with none simply list
// their equipment flat.
const AreaEquipmentCategoryAdded = defineEvent('AreaEquipmentCategoryAdded', {
  areaId: tt.UUID,
  categoryId: tt.UUID,
  name: t.string,
});

// Equipment that was in the category becomes uncategorised.
const AreaEquipmentCategoryRemoved = defineEvent(
  'AreaEquipmentCategoryRemoved',
  {
    areaId: tt.UUID,
    categoryId: tt.UUID,
  }
);

// One save of an area's category table: only the equipment whose category
// changed. A null categoryId means uncategorised.
const AreaEquipmentCategoriesAssigned = defineEvent(
  'AreaEquipmentCategoriesAssigned',
  {
    areaId: tt.UUID,
    assignments: t.readonlyArray(
      t.strict({
        equipmentId: tt.UUID,
        categoryId: t.union([tt.UUID, t.null]),
      })
    ),
  }
);

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
// Renaming keeps the old name working: it becomes an alias, so a trouble
// ticket naming the machine the way the form used to is still matched to it.
// Where the written risk assessment for this machine lives. Empty clears it.
const EquipmentRiskAssessmentUrlSet = defineEvent(
  'EquipmentRiskAssessmentUrlSet',
  {
    equipmentId: tt.UUID,
    riskAssessmentUrl: t.string,
  }
);

// What to learn about this machine, printed as points under "Learn" on its
// sign. One point per line; empty clears them.
const EquipmentLearnPointsSet = defineEvent('EquipmentLearnPointsSet', {
  equipmentId: tt.UUID,
  learnPoints: t.string,
});

const EquipmentNameChanged = defineEvent('EquipmentNameChanged', {
  equipmentId: tt.UUID,
  name: t.string,
  previousName: t.string,
});

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

// A purchasing area holds a yearly budget on behalf of one or more areas
// (e.g. "Craft & Art" for the Craft Room and the Art Space). Money is in
// whole pence throughout. The budget year is the calendar year.
const PurchasingAreaCreated = defineEvent('PurchasingAreaCreated', {
  id: tt.UUID,
  name: t.string,
  yearlyBudgetPence: t.number,
  // Whether it takes purchase requests and counts its budget as live. New
  // ones start inactive so they can be set up first; ones created before
  // activation existed were already in use, so they count as active.
  active: tt.withFallback(t.boolean, true),
});

// A super user turns a purchasing area on or off. Only an active one takes
// new purchase requests; requests already made carry on either way.
const PurchasingAreaActivated = defineEvent('PurchasingAreaActivated', {
  purchasingAreaId: tt.UUID,
});

const PurchasingAreaDeactivated = defineEvent('PurchasingAreaDeactivated', {
  purchasingAreaId: tt.UUID,
});

// Only one with no purchase requests or recorded spending can be removed, so
// nothing is left pointing at it. Its areas and purchasers go with it.
const PurchasingAreaRemoved = defineEvent('PurchasingAreaRemoved', {
  purchasingAreaId: tt.UUID,
});

const PurchasingAreaRenamed = defineEvent('PurchasingAreaRenamed', {
  purchasingAreaId: tt.UUID,
  name: t.string,
});

const PurchasingAreaBudgetSet = defineEvent('PurchasingAreaBudgetSet', {
  purchasingAreaId: tt.UUID,
  yearlyBudgetPence: t.number,
});

// A different budget for one calendar year only, e.g. an extension: the
// usual budget (PurchasingAreaBudgetSet) applies again the year after.
const PurchasingAreaYearBudgetSet = defineEvent(
  'PurchasingAreaYearBudgetSet',
  {
    purchasingAreaId: tt.UUID,
    budgetYear: t.number,
    yearlyBudgetPence: t.number,
  }
);

// Spending a super user records directly against a purchasing area's budget
// for a year - e.g. what was spent before purchase requests were in the app -
// alongside the spending from purchase requests.
const PurchasingAreaSpendRecorded = defineEvent('PurchasingAreaSpendRecorded', {
  id: tt.UUID,
  purchasingAreaId: tt.UUID,
  budgetYear: t.number,
  amountPence: t.number,
  description: t.string,
  // Out of the yearly budget, or approved spending outside it. Recorded
  // before approved spending existed means the budget.
  kind: tt.withFallback(RecordedSpendKindCodec, 'budget'),
});

// Takes back spending recorded by mistake.
const PurchasingAreaSpendRemoved = defineEvent('PurchasingAreaSpendRemoved', {
  id: tt.UUID,
});

// An area belongs to at most one purchasing area at a time.
const AreaAssignedToPurchasingArea = defineEvent(
  'AreaAssignedToPurchasingArea',
  {
    purchasingAreaId: tt.UUID,
    areaId: tt.UUID,
  }
);

const AreaUnassignedFromPurchasingArea = defineEvent(
  'AreaUnassignedFromPurchasingArea',
  {
    purchasingAreaId: tt.UUID,
    areaId: tt.UUID,
  }
);

// Purchasers may submit purchase requests for the purchasing area.
const PurchaserAdded = defineEvent('PurchaserAdded', {
  purchasingAreaId: tt.UUID,
  memberNumber: t.number,
});

const PurchaserRemoved = defineEvent('PurchaserRemoved', {
  purchasingAreaId: tt.UUID,
  memberNumber: t.number,
});

// A purchaser asking to buy something. The outcome is computed by the server
// (src/purchasing/classify-purchase.ts) from the itemised total - the sum of
// the shop costs - at submission, and recorded here along with the budget
// figures it was computed from, so the record says what the member was told
// even if the budget or the rules change later. The itemised total is also
// what counts against the budget.
// There is no approval step yet; one would follow as further events about the
// same request id.
const PurchaseRequestSubmitted = defineEvent('PurchaseRequestSubmitted', {
  id: tt.UUID,
  purchasingAreaId: tt.UUID,
  submittedByMemberNumber: t.number,
  summary: t.string,
  totalPence: t.number,
  // Each shop with the items bought there and any delivery charge.
  purchases: t.readonlyArray(PurchaseCodec),
  justification: t.string,
  isMemberPaidConsumable: t.boolean,
  // Other areas it affects, whose owners need a chance to give their input.
  affectedAreaIds: t.readonlyArray(tt.UUID),
  // A moderate to high health and safety risk that will need mitigating.
  healthAndSafetyRisk: t.boolean,
  // The proposal, when the request needs one; see src/purchasing/proposal.ts.
  proposal: t.union([ProposalCodec, t.null]),
  outcome: PurchaseRequestOutcomeCodec,
  // What approval it needs before going ahead; see PurchaseApprovalCodec.
  approval: PurchaseApprovalCodec,
  outcomeReason: t.string,
  budgetYear: t.number,
  yearlyBudgetPence: t.number,
  spentThisYearPence: t.number,
  // Bought by whoever sent it (a super user or the area's purchaser), e.g.
  // with Capital on Tap, rather than waiting for approval. The purchases are
  // empty then; totalPence is what it cost.
  boughtDirectly: tt.withFallback(t.boolean, false),
});

// A super user approving a purchase request, so it can go ahead and counts
// against its purchasing area's budget.
const PurchaseRequestApproved = defineEvent('PurchaseRequestApproved', {
  id: tt.UUID,
  // What was agreed, e.g. at an owners' forum. Required for director
  // approval; see src/commands/purchase-request/approve.ts.
  note: tt.withFallback(t.union([t.string, t.null]), null),
  // Approved by someone who has already bought it, e.g. with Capital on
  // Tap: it goes straight to bought.
  alsoBought: tt.withFallback(t.boolean, false),
  // What it really cost, when bought and different from what was asked.
  actualCostPence: tt.withFallback(t.union([t.number, t.null]), null),
});

// An approved purchase request bought by a purchaser or super user.
const PurchaseRequestBought = defineEvent('PurchaseRequestBought', {
  id: tt.UUID,
  // What it really cost, when different from what was asked.
  actualCostPence: t.union([t.number, t.null]),
});

// Purchase request emails sent for one event (a request sent, approved or
// declined), so they aren't sent twice and the outcome can go to everyone
// who heard about the request. See src/sync-worker/notify_purchase_requests.ts.
const PurchaseRequestNotificationSent = defineEvent(
  'PurchaseRequestNotificationSent',
  {
    requestId: tt.UUID,
    notifiedEventIndex: t.number,
    recipientMemberNumbers: t.readonlyArray(t.number),
  }
);

// A super user turning a purchase request down, saying why.
const PurchaseRequestDeclined = defineEvent('PurchaseRequestDeclined', {
  id: tt.UUID,
  reason: t.string,
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

// An admin attached an address Recurly bills for this member, taking the
// billing record as proof it is theirs: the address counts as verified from
// here on without the member clicking anything. Its own event, rather than
// an add followed by a verify, so the timeline says who vouched for it.
const MemberEmailLinkedByAdmin = defineEvent('MemberEmailLinkedByAdmin', {
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
// What one member wants to hear about one scope - an area, a machine, or one
// of the standing groups. 'follow' means they have said nothing of their own
// and take whatever sits above them, which is also how a choice is undone.
//
// The actor says who decided: a member setting their own, or the system doing
// it because they were made a trainer or an owner. The two read very
// differently in a member's history, so they are not flattened together.
const MemberNotificationPreferenceSet = defineEvent(
  'MemberNotificationPreferenceSet',
  {
    memberNumber: t.number,
    // 'reported-by-me' | 'my-areas' | 'other-areas' | 'area:<id>' |
    // 'equipment:<id>'
    scope: t.string,
    preference: t.keyof({
      live: null,
      daily: null,
      weekly: null,
      none: null,
      follow: null,
    }),
    // True when this was the app changing somebody's mind for them and
    // telling them so - a new trainer, a new owner. Somebody setting their
    // own preference is not being written to, and the two cannot be told
    // apart by the actor: the API sets preferences as the system too.
    notified: tt.withFallback(t.boolean, false),
  }
);

// One summary email, to one member, covering everything up to a point in the
// log. The watermark is what stops the next one repeating it, and recording it
// only when something was actually sent is what keeps a quiet week silent.
const MemberTicketDigestSent = defineEvent('MemberTicketDigestSent', {
  memberNumber: t.number,
  cadence: t.keyof({daily: null, weekly: null}),
  // The last event this summary covered.
  upToEventIndex: t.number,
  // How many changes it carried, so the log says whether it was worth sending.
  changeCount: t.number,
  // True when the summary was worked out but held back rather than sent,
  // which is how the stack runs before the mail is switched on. The
  // watermark still moves, so switching on causes no backlog.
  suppressed: tt.withFallback(t.boolean, false),
});

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
    // Why: the archived view shows it, and "hide like this" is the list to
    // write the next noise rule from.
    reason: MailboxArchiveReason,
  }
);

const MailboxConversationUnarchived = defineEvent(
  'MailboxConversationUnarchived',
  {
    gmailMessageIds: t.array(t.string),
  }
);

// What a numbered e-ink display shows: a machine's open trouble tickets.
// Displays are flashed once with /e-ink/<n>.png, so moving one to another
// machine is this rather than a reflash. Assigning a display that already
// shows something replaces it.
const EinkDisplayAssigned = defineEvent('EinkDisplayAssigned', {
  displayNumber: t.number,
  equipmentId: tt.UUID,
});

// Back to showing "not set up".
const EinkDisplayUnassigned = defineEvent('EinkDisplayUnassigned', {
  displayNumber: t.number,
});

// A trainer putting an in-person training on the calendar for a machine.
// The trainer is whoever scheduled it: sessions are not scheduled on somebody
// else's behalf. Times are instants; the form reads them as UK local time.
// attendees are members the trainer booked in when arranging it - someone
// they arranged it with directly - and take up some of the spaces. The
// description is the trainer's own markdown (see templates/markdown.ts).
const TrainingSessionScheduled = defineEvent('TrainingSessionScheduled', {
  sessionId: tt.UUID,
  equipmentId: tt.UUID,
  trainerMemberNumber: t.number,
  startsAt: tt.DateFromISOString,
  endsAt: tt.DateFromISOString,
  spaces: t.number,
  description: t.string,
  attendees: t.array(t.number),
  // How long before the start members stop being able to sign up. Sessions
  // arranged before this was asked closed when they started.
  signUpsCloseHoursBefore: tt.withFallback(t.number, 0),
});

// What a member needs before a machine's in-person training: whether its
// online quiz must be passed first, and which other machines they must
// already be trained on (the Trotec after the HPC). Replaces whatever was set
// before; a machine with nothing set needs its quiz and nothing else.
const EquipmentTrainingRequirementsSet = defineEvent(
  'EquipmentTrainingRequirementsSet',
  {
    equipmentId: tt.UUID,
    quizRequired: t.boolean,
    prerequisiteEquipmentIds: t.readonlyArray(tt.UUID),
  }
);

// A member telling a machine's trainers they would like to be trained on it.
// Said again whenever they like, so the latest time shows whether the wish is
// still current.
const TrainingInterestExpressed = defineEvent('TrainingInterestExpressed', {
  equipmentId: tt.UUID,
  memberNumber: t.number,
});

// A member taking a place on a training session themselves.
const TrainingSessionSignedUp = defineEvent('TrainingSessionSignedUp', {
  sessionId: tt.UUID,
  memberNumber: t.number,
});

// A member giving up their place, which opens it to somebody else.
const TrainingSessionSignUpCancelled = defineEvent(
  'TrainingSessionSignUpCancelled',
  {
    sessionId: tt.UUID,
    memberNumber: t.number,
  }
);

// The training is not happening. Whoever was booked on it is told, with the
// reason when the trainer gave one.
const TrainingSessionCancelled = defineEvent('TrainingSessionCancelled', {
  sessionId: tt.UUID,
  reason: t.string,
});

// Training session emails sent for one event (a sign-up, a cancelled place, a
// cancelled session), so they aren't sent twice. See
// src/sync-worker/notify_training_sessions.ts.
const TrainingSessionNotificationSent = defineEvent(
  'TrainingSessionNotificationSent',
  {
    sessionId: tt.UUID,
    notifiedEventIndex: t.number,
    recipientMemberNumbers: t.readonlyArray(t.number),
  }
);

const MemberDetailsUpdated = defineEvent('MemberDetailsUpdated', {
  memberNumber: t.number,
  name: t.union([t.string, t.undefined]),
  formOfAddress: t.union([t.string, t.undefined]),
});

// A Paxton fob held by a member, as exported from the Paxton PC. The fob id
// is Paxton's number for the fob; recording the same fob id again updates
// its access level (and reassigns it if another member held it before).
// The Paxton-side name is kept as it appeared in the export, so the member
// it was matched to can be checked later.
const MemberFobRecorded = defineEvent('MemberFobRecorded', {
  memberNumber: t.number,
  // Integer, not number: the read model keys on this as an INTEGER PRIMARY
  // KEY, and a stored non-integer would stop replay at this event for good.
  fobId: t.Int,
  accessLevel: t.string,
  paxtonName: t.string,
});

const MemberFobRemoved = defineEvent('MemberFobRemoved', {
  memberNumber: t.number,
  fobId: t.Int,
});

const OwnerAgreementSigned = defineEvent('OwnerAgreementSigned', {
  memberNumber: t.number,
  signedAt: tt.DateFromISOString,
  // The key of the version signed (see owner-agreement/versions).
  // Signatures from before versioning were all of the original agreement.
  agreementVersion: tt.withFallback(t.string, '2024-original'),
  // The responsibilities the owner said they're interested in taking on.
  interestedIn: tt.withFallback(
    t.strict({
      equipment: t.readonlyArray(t.string),
      area: t.readonlyArray(t.string),
    }),
    {equipment: [], area: []}
  ),
});

// A reminder to re-sign the owner agreement has been emailed (dedup marker,
// committed before sending - prefer a missed email over duplicates).
const OwnerAgreementReminderSent = defineEvent('OwnerAgreementReminderSent', {
  memberNumber: t.number,
  // The end of the term being reminded about.
  termEnds: tt.DateFromISOString,
  stage: ReminderStage,
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
  // Whether the training recorded against the old number still counts.
  // Makespace policy is that training lapses after 6+ months away, so the
  // admin marking the rejoin decides. Rejoins recorded before this existed
  // always carried training over, hence the fallback.
  carryOverTraining: tt.withFallback(t.boolean, true),
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
  // 'email': raised by a manager from the imported mailbox. The sender is
  // not a member reporting through the app, so no confirmation is sent.
  // 'public': raised in the app by somebody who was not logged in. The
  // confirmation goes to the address they gave, whoever it belongs to.
  source: tt.withFallback(
    t.keyof({sheet: null, app: null, email: null, public: null}),
    'sheet'
  ),
  equipmentId: tt.withFallback(t.union([tt.UUID, t.null]), null),
  // Which unit, when the equipment stands for several machines.
  machine: tt.withFallback(t.string, ''),
  // Placed directly in an area rather than resolved from a name: a ticket
  // raised from the management mailbox belongs to the management team.
  areaId: tt.withFallback(t.union([tt.UUID, t.null]), null),
  // '' means the issue text is the title, as it always was.
  title: tt.withFallback(t.string, ''),
  // The mailbox conversation it was raised from, by that conversation's id;
  // '' when it was not.
  mailboxConversationId: tt.withFallback(t.string, ''),
  // The member number typed on the public form. Kept apart from
  // submittedMemberNumber, which is only set when the ticket is known to be
  // that member's: a number is easy to type and proves nothing.
  providedMemberNumber: tt.withFallback(t.union([t.number, t.null]), null),
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

// A member took a ticket raised without logging in onto their account, by
// following the link that was emailed to the address on the ticket.
const TroubleTicketClaimed = defineEvent('TroubleTicketClaimed', {
  ticketId: tt.UUID,
  memberNumber: t.number,
});

// Records that change-notification emails have been sent for a specific
// status-change event (identified by its event index), so the notifier doesn't
// send them again.
const TroubleTicketNotificationSent = defineEvent(
  'TroubleTicketNotificationSent',
  {
    ticketId: tt.UUID,
    notifiedEventIndex: t.number,
    // Who the notification went to, so the ticket's history can say. Empty
    // for markers recorded before this was kept, and when nobody had an
    // address to send to.
    recipients: tt.withFallback(t.array(t.string), []),
    // The same people by member number, where we know it. Addresses change
    // and some senders are not members at all, so counting how much somebody
    // has heard from us cannot be done by matching strings.
    recipientMemberNumbers: tt.withFallback(t.array(t.number), []),
  }
);

export const events = [
  AreaCreated,
  AreaRemoved,
  AreaEmailUpdated,
  EquipmentAdded,
  EquipmentCategoryChanged,
  AreaEquipmentCategoryAdded,
  AreaEquipmentCategoryRemoved,
  AreaEquipmentCategoriesAssigned,
  EquipmentMachinesSet,
  EquipmentNameChanged,
  EquipmentRiskAssessmentUrlSet,
  EquipmentLearnPointsSet,
  EquipmentMarkedObsolete,
  EquipmentNameAliasAdded,
  EquipmentNameAliasRemoved,
  AreaNameAliasAdded,
  AreaNameAliasRemoved,
  OwnerAdded,
  OwnerRemoved,
  PurchasingAreaCreated,
  PurchasingAreaActivated,
  PurchasingAreaDeactivated,
  PurchasingAreaRemoved,
  PurchasingAreaRenamed,
  PurchasingAreaBudgetSet,
  PurchasingAreaYearBudgetSet,
  PurchasingAreaSpendRecorded,
  PurchasingAreaSpendRemoved,
  AreaAssignedToPurchasingArea,
  AreaUnassignedFromPurchasingArea,
  PurchaserAdded,
  PurchaserRemoved,
  PurchaseRequestSubmitted,
  PurchaseRequestApproved,
  PurchaseRequestDeclined,
  PurchaseRequestBought,
  PurchaseRequestNotificationSent,
  SuperUserDeclared,
  SuperUserRevoked,
  TrainerAdded,
  TrainerRemoved,
  MemberNumberLinkedToEmail,
  MemberEmailAdded,
  MemberEmailVerificationRequested,
  MemberEmailVerified,
  MemberEmailLinkedByAdmin,
  MemberPrimaryEmailChanged,
  LinkingMemberNumberToAnAlreadyUsedEmailAttempted,
  EquipmentTrainingSheetRegistered,
  EquipmentTrainingSheetRemoved,
  EquipmentGuideUrlSet,
  EquipmentTrainingQuizResult,
  EquipmentTrainingQuizSync,
  MemberDetailsUpdated,
  MemberFobRecorded,
  MemberFobRemoved,
  OwnerAgreementSigned,
  OwnerAgreementReminderSent,
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
  TroubleTicketClaimed,
  TroubleTicketNotificationSent,
  MemberNotificationPreferenceSet,
  MemberTicketDigestSent,
  NotificationCreated,
  NotificationDismissed,
  NotificationRevoked,
  NotificationEmailSent,
  MailboxConversationArchived,
  MailboxConversationUnarchived,
  EinkDisplayAssigned,
  EinkDisplayUnassigned,
  TrainingSessionScheduled,
  TrainingSessionSignedUp,
  TrainingSessionSignUpCancelled,
  TrainingSessionCancelled,
  TrainingSessionNotificationSent,
  EquipmentTrainingRequirementsSet,
  TrainingInterestExpressed,
];

export const DomainEvent = t.union([
  AreaCreated.codec,
  AreaRemoved.codec,
  AreaEmailUpdated.codec,
  EquipmentAdded.codec,
  EquipmentCategoryChanged.codec,
  AreaEquipmentCategoryAdded.codec,
  AreaEquipmentCategoryRemoved.codec,
  AreaEquipmentCategoriesAssigned.codec,
  EquipmentMachinesSet.codec,
  EquipmentNameChanged.codec,
  EquipmentRiskAssessmentUrlSet.codec,
  EquipmentLearnPointsSet.codec,
  EquipmentMarkedObsolete.codec,
  EquipmentNameAliasAdded.codec,
  EquipmentNameAliasRemoved.codec,
  AreaNameAliasAdded.codec,
  AreaNameAliasRemoved.codec,
  OwnerAdded.codec,
  OwnerRemoved.codec,
  PurchasingAreaCreated.codec,
  PurchasingAreaActivated.codec,
  PurchasingAreaDeactivated.codec,
  PurchasingAreaRemoved.codec,
  PurchasingAreaRenamed.codec,
  PurchasingAreaBudgetSet.codec,
  PurchasingAreaYearBudgetSet.codec,
  PurchasingAreaSpendRecorded.codec,
  PurchasingAreaSpendRemoved.codec,
  AreaAssignedToPurchasingArea.codec,
  AreaUnassignedFromPurchasingArea.codec,
  PurchaserAdded.codec,
  PurchaserRemoved.codec,
  PurchaseRequestSubmitted.codec,
  PurchaseRequestApproved.codec,
  PurchaseRequestDeclined.codec,
  PurchaseRequestBought.codec,
  PurchaseRequestNotificationSent.codec,
  SuperUserDeclared.codec,
  SuperUserRevoked.codec,
  TrainerAdded.codec,
  TrainerRemoved.codec,
  MemberNumberLinkedToEmail.codec,
  MemberEmailAdded.codec,
  MemberEmailVerificationRequested.codec,
  MemberEmailVerified.codec,
  MemberEmailLinkedByAdmin.codec,
  MemberPrimaryEmailChanged.codec,
  LinkingMemberNumberToAnAlreadyUsedEmailAttempted.codec,
  EquipmentTrainingSheetRegistered.codec,
  EquipmentTrainingSheetRemoved.codec,
  EquipmentGuideUrlSet.codec,
  EquipmentTrainingQuizResult.codec,
  EquipmentTrainingQuizSync.codec,
  MemberDetailsUpdated.codec,
  MemberFobRecorded.codec,
  MemberFobRemoved.codec,
  OwnerAgreementSigned.codec,
  OwnerAgreementReminderSent.codec,
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
  TroubleTicketClaimed.codec,
  TroubleTicketNotificationSent.codec,
  MemberNotificationPreferenceSet.codec,
  MemberTicketDigestSent.codec,
  NotificationCreated.codec,
  NotificationDismissed.codec,
  NotificationRevoked.codec,
  NotificationEmailSent.codec,
  MailboxConversationArchived.codec,
  MailboxConversationUnarchived.codec,
  EinkDisplayAssigned.codec,
  EinkDisplayUnassigned.codec,
  TrainingSessionScheduled.codec,
  TrainingSessionSignedUp.codec,
  TrainingSessionSignUpCancelled.codec,
  TrainingSessionCancelled.codec,
  TrainingSessionNotificationSent.codec,
  EquipmentTrainingRequirementsSet.codec,
  TrainingInterestExpressed.codec,
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
