import * as t from 'io-ts';
import * as tt from 'io-ts-types';

export const DomainEvent = t.strict({
  type: t.literal('SuperUserDeclared'),
  memberNumber: tt.IntFromString,
  declaredAt: tt.DateFromISOString,
});

export type DomainEvent = t.TypeOf<typeof DomainEvent>;

type EventName = DomainEvent['type'];

export type EventOfType<T extends EventName> = DomainEvent & {type: T};

export const isEventOfType =
  <T extends EventName>(name: T) =>
  (event: DomainEvent): event is EventOfType<T> =>
    event.type === name;

type EventSpecificFields<T extends EventName> = Omit<EventOfType<T>, 'type'>;

type EventBase<T> = {type: T};

export const constructEvent =
  <T extends EventName, A extends EventSpecificFields<T>>(type: T) =>
  (args: A & Partial<{date: Date}>): EventBase<T> & A => ({
    type,
    ...args,
  });
