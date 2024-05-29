import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {EmailAddressCodec} from './email-address';

export const DomainEvent = t.union([
  t.strict({
    type: t.literal('AreaCreated'),
    name: t.string,
    description: t.string,
    id: tt.UUID,
  }),
  t.strict({
    type: t.literal('EquipmentAdded'),
    name: t.string,
    id: tt.UUID,
    areaId: tt.UUID,
  }),
  t.strict({
    type: t.literal('OwnerAdded'),
    areaId: tt.UUID,
    memberNumber: t.number,
  }),
  t.strict({
    type: t.literal('SuperUserDeclared'),
    memberNumber: t.number,
    declaredAt: tt.DateFromISOString,
  }),
  t.strict({
    type: t.literal('SuperUserRevoked'),
    memberNumber: t.number,
    revokedAt: tt.DateFromISOString,
  }),
  t.strict({
    type: t.literal('MemberNumberLinkedToEmail'),
    memberNumber: t.number,
    email: EmailAddressCodec,
  }),
  t.strict({
    type: t.literal('EquipmentTrainingSheetRegistered'),
    equipmentId: tt.UUID,
    trainingSheetId: t.string,
  }),
]);

export type DomainEvent = t.TypeOf<typeof DomainEvent>;

type EventName = DomainEvent['type'];

type EventOfType<T extends EventName> = DomainEvent & {type: T};

export const isEventOfType =
  <T extends EventName>(name: T) =>
  (event: DomainEvent): event is EventOfType<T> =>
    event.type === name;

type EventSpecificFields<T extends EventName> = Omit<EventOfType<T>, 'type'>;

type EventBase<T> = {type: T};

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

export const constructEvent =
  <T extends EventName, A extends EventSpecificFields<T>>(type: T) =>
  (args: A): EventBase<T> & A => ({
    type,
    ...args,
  });
