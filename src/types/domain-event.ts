import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {EmailAddressCodec} from './email-address';
import {Actor} from './actor';

const eventCodec = <A extends string, T extends t.Props>(
  type: A,
  payload: T
): t.ExactC<t.TypeC<T & {type: t.LiteralC<A>; actor: typeof Actor}>> =>
  t.strict({
    ...payload,
    type: t.literal(type),
    actor: Actor,
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
    declaredAt: tt.DateFromISOString,
  }),
  eventCodec('SuperUserRevoked', {
    memberNumber: t.number,
    revokedAt: tt.DateFromISOString,
  }),
  eventCodec('MemberNumberLinkedToEmail', {
    memberNumber: t.number,
    email: EmailAddressCodec,
  }),
]);

export type DomainEvent = t.TypeOf<typeof DomainEvent>;

type EventName = DomainEvent['type'];

type EventOfType<T extends EventName> = DomainEvent & {type: T};

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

type EventBase<T> = {type: T; actor: Actor};

type EventSpecificFields<T extends EventName> = Omit<
  EventOfType<T>,
  'type' | 'actor'
>;

export const constructEvent =
  <T extends EventName, A extends EventSpecificFields<T> & {actor?: Actor}>(
    type: T
  ) =>
  (args: A): EventBase<T> & A => ({
    type,
    actor: args.actor ?? ({tag: 'system'} satisfies Actor),
    ...args,
  });
