import {Client} from '@libsql/client';
import {getAllEventsAfterEventIndex} from '../../init-dependencies/event-store/get-all-events';
import {pipe} from 'fp-ts/lib/function';
import {StoredDomainEvent} from '../../types';
import * as TE from 'fp-ts/TaskEither';

function payloadToString(payload: unknown): string {
  return JSON.stringify(payload);
}

export const asyncRefresh = (
  eventStoreDb: Client,
  updateState: (event: StoredDomainEvent) => void
) => {
  let lastSeenEventIndex = 0;
  return () => async () => {
    const events = await pipe(
      getAllEventsAfterEventIndex(eventStoreDb)(lastSeenEventIndex),
      TE.getOrElse(failure => {
        throw new Error(
          `unexpected Left from getAllEvents: ${failure.message} ${payloadToString(failure.payload)}`
        );
      })
    )();
    if (events.length > 0) {
      events.forEach(updateState);
      lastSeenEventIndex = events[events.length - 1].event_index;
    }
  };
};
