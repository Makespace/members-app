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

const EquipmentTrainingQuizResult = defineEvent('EquipmentTrainingQuizResult', {
  equipmentId: tt.UUID,
  trainingSheetId: t.string,
  memberNumberProvided: t.union([t.number, t.null]),
  emailProvided: t.union([t.string, t.null]), // Note this is a free-form text entry without validation so it might not be a valid email hence no use of EmailAddressCodec.
  score: t.number,
  id: tt.UUID,
  maxScore: t.number,
  percentage: t.number,
  timestampEpochMS: t.number, // Unix Epoch January 1st 1970.
});

const EquipmentTrainingQuizSync = defineEvent('EquipmentTrainingQuizSync', {
  equipmentId: tt.UUID,
});

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

const RevokeTrainedOnEquipment = defineEvent('RevokeTrainedOnEquipment', {
  equipmentId: tt.UUID,
  memberNumber: t.number,
  revokedByMemberNumber: t.union([t.number, t.null]), // Null to indicate system.
});

const MemberEmailChanged = defineEvent('MemberEmailChanged', {
  memberNumber: t.number,
  newEmail: EmailAddressCodec,
});

const EquipmentTrainingQuizMemberNumberUpdated = defineEvent(
  'EquipmentTrainingQuizMemberNumberUpdated',
  {
    quizId: tt.UUID,
    newMemberNumber: t.number,
  }
);

const EquipmentTrainingQuizEmailUpdated = defineEvent(
  'EquipmentTrainingQuizEmailUpdated',
  {
    quizId: tt.UUID,
    newEmail: t.string,
  }
);

const TroubleTicketResponseSubmitted = defineEvent(
  'TroubleTicketResponseSubmitted',
  {
    response_submitted_epoch_ms: t.number, // Unix Epoch January 1st 1970.
    email_address: t.union([t.string, t.null]), // Do not trust this - it is not verified.
    which_equipment: t.union([t.string, t.null]),
    submitter_name: t.union([t.string, t.null]), // Do not trust this - it is not verified
    submitter_membership_number: t.union([t.number, t.null]), // Do not trust this - it is not verified
    submitted_response: t.record(t.string, t.string),
  }
);

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
  RevokeTrainedOnEquipment,
  MemberEmailChanged,
  EquipmentTrainingQuizMemberNumberUpdated,
  EquipmentTrainingQuizEmailUpdated,
  TroubleTicketResponseSubmitted,
  RecurlySubscriptionUpdated,
  MemberRejoinedWithNewNumber,
  MemberRejoinedWithExistingNumber,
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
  RevokeTrainedOnEquipment.codec,
  MemberEmailChanged.codec,
  EquipmentTrainingQuizMemberNumberUpdated.codec,
  EquipmentTrainingQuizEmailUpdated.codec,
  TroubleTicketResponseSubmitted.codec,
  RecurlySubscriptionUpdated.codec,
  MemberRejoinedWithNewNumber.codec,
  MemberRejoinedWithExistingNumber.codec,
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
  <T extends EventName, A extends EventSpecificFields<T> & {actor?: Actor}>(
    type: T
  ) =>
  (args: A): EventBase<T> & A => ({
    type,
    actor: args.actor ?? ({tag: 'system'} satisfies Actor),
    recordedAt: new Date(),
    ...args,
  });
