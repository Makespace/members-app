import { Int } from 'io-ts';
import { DomainEvent } from '../../types';

export type ViewModel = {
  events: ReadonlyArray<{
      id: string;
      event_id: string;
      reverted_by_number: Int;
      revert_reason: string;
      revert_at: Date;
      payload: DomainEvent;
  }>;
};
