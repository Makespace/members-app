import {UUID} from 'io-ts-types';
import {Actor} from './actor';
import {StoredDomainEvent} from './domain-event';

export type DeletedEvent = {
  event_id: UUID;
  deletedAt: Date;
  deletedBy: Actor;
  reason: string;
};

export type StoredDomainEventWithDeletion = StoredDomainEvent & {
  deleted: DeletedEvent | null;
};
