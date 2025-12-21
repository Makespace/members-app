import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
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
  // Old event no longer used.
  'TroubleTicketResponseSubmitted',
  {}
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

const MemberEmailChanged = defineEvent('MemberEmailChanged', {
  memberNumber: t.number,
  newEmail: EmailAddressCodec,
});

const RecurlySubscriptionUpdated = defineEvent('RecurlySubscriptionUpdated', {
  email: EmailAddressCodec,
  hasActiveSubscription: t.boolean,
  hasPausedSubscription: t.boolean,
  hasFutureSubscription: t.boolean,
  hasCanceledSubscription: t.boolean,
  hasPastDueInvoice: t.boolean,
});

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
  EquipmentAdded,
  OwnerAdded,
  OwnerRemoved,
  SuperUserDeclared,
  SuperUserRevoked,
  TrainerAdded,
  MemberNumberLinkedToEmail,
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
  MemberEmailChanged,
  EquipmentTrainingQuizMemberNumberUpdated,
  EquipmentTrainingQuizEmailUpdated,
  TroubleTicketResponseSubmitted,
  RecurlySubscriptionUpdated,
  MemberRejoinedWithNewNumber,
  MemberRejoinedWithExistingNumber,
  TrainingStatNotificationSent,
];

export const DomainEvent = t.union([
  AreaCreated.codec,
  AreaRemoved.codec,
  EquipmentAdded.codec,
  OwnerAdded.codec,
  OwnerRemoved.codec,
  SuperUserDeclared.codec,
  SuperUserRevoked.codec,
  TrainerAdded.codec,
  MemberNumberLinkedToEmail.codec,
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
  MemberEmailChanged.codec,
  EquipmentTrainingQuizMemberNumberUpdated.codec,
  EquipmentTrainingQuizEmailUpdated.codec,
  TroubleTicketResponseSubmitted.codec,
  RecurlySubscriptionUpdated.codec,
  MemberRejoinedWithNewNumber.codec,
  MemberRejoinedWithExistingNumber.codec,
  TrainingStatNotificationSent.codec,
]);

export type DomainEvent = t.TypeOf<typeof DomainEvent>;

export type EventName = DomainEvent['type'];

export type EventOfType<T extends EventName> = DomainEvent & {type: T};

export const isEventOfType =
  <T extends EventName>(name: T) =>
  (event: DomainEvent): event is EventOfType<T> =>
    event.type === name;

export type SubsetOfDomainEvent<Names extends Array<EventName>> = Extract<
  DomainEvent,
  {type: Names[number]}
>;

export const filterByName =
  <T extends Array<EventName>>(names: T) =>
  (events: ReadonlyArray<DomainEvent>): ReadonlyArray<SubsetOfDomainEvent<T>> =>
    pipe(
      events,
      RA.filter(({type}) => names.includes(type)),
      RA.map(filtered => filtered as SubsetOfDomainEvent<T>)
    );

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
