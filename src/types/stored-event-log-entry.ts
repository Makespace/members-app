import * as t from 'io-ts';
import {StoredDomainEvent} from './domain-event';
import {StoredEventDeletion} from './stored-event-deletion';

export const StoredEventLogEntry = t.intersection([
  StoredDomainEvent,
  t.strict({
    deletion: t.union([StoredEventDeletion, t.null]),
  }),
]);

export type StoredEventLogEntry = t.TypeOf<typeof StoredEventLogEntry>;
