import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {EmailAddressCodec} from './email-address';
import {Actor} from './actor';

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

export const DomainEvent = t.union([
  eventCodec('AreaCreated', {
    name: t.string,
    id: tt.UUID,
  }),
  eventCodec('EquipmentAdded', {
    name: t.string,
    id: tt.UUID,
    areaId: tt.UUID,
  }),
  eventCodec('OwnerAdded', {
    areaId: tt.UUID,
    memberNumber: t.number,
  }),
  eventCodec('SuperUserDeclared', {
    memberNumber: t.number,
  }),
  eventCodec('SuperUserRevoked', {
    memberNumber: t.number,
  }),
  eventCodec('TrainerAdded', {
    memberNumber: t.number,
    equipmentId: tt.UUID,
  }),
  eventCodec('MemberNumberLinkedToEmail', {
    memberNumber: t.number,
    email: EmailAddressCodec,
  }),
  eventCodec('EquipmentTrainingSheetRegistered', {
    equipmentId: tt.UUID,
    trainingSheetId: t.string,
  }),
  eventCodec('EquipmentTrainingQuizResult', {
    equipmentId: tt.UUID,
    trainingSheetId: t.string,
    email: t.string,
    score: t.number,
    id: tt.UUID,
    maxScore: t.number,
    percentage: t.number,
    fullMarks: t.boolean, // Allow quick index/search for the events owners care about most.
    timestampEpochS: t.number, // Unix Epoch January 1st 1970.
    quizAnswers: t.record(t.string, t.union([t.string, t.null])),
  }),
  eventCodec('MemberDetailsUpdated', {
    memberNumber: t.number,
    name: t.union([t.string, t.undefined]),
    pronouns: t.union([t.string, t.undefined]),
  }),
  eventCodec('OwnerAgreementSigned', {
    memberNumber: t.number,
    signedAt: tt.DateFromISOString,
  }),
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
