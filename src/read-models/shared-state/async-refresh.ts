import {Client} from '@libsql/client';
import {getAllEventsIncludingDeletedAfterEventIndex} from '../../init-dependencies/event-store/get-all-events';
import {pipe} from 'fp-ts/lib/function';
import {DomainEvent} from '../../types';
import * as TE from 'fp-ts/TaskEither';

function payloadToString(payload: unknown): string {
  return JSON.stringify(payload);
}

export const asyncRefresh = (
  eventStoreDb: Client,
  updateState: (event: DomainEvent) => void
) => {
  let lastReadEventIndex = 0;
  return () => async () => {
    const events = await pipe(
      getAllEventsIncludingDeletedAfterEventIndex(eventStoreDb)(
        lastReadEventIndex
      ),
      TE.getOrElse(failure => {
        throw new Error(
          `unexpected Left from getAllEvents: ${failure.message} ${payloadToString(failure.payload)}`
        );
      })
    )();
    const newEvents = events.filter(
      event => event.event_index > lastReadEventIndex
    );
    if (newEvents.length > 0) {
      newEvents
        .filter(event => event.deleted === null)
        .forEach(({deleted: _deleted, ...event}) => updateState(event));
      lastReadEventIndex = newEvents[newEvents.length - 1].event_index;
    }
  };
};
