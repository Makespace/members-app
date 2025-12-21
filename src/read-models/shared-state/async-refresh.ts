import {Client} from '@libsql/client';
import {getAllEvents} from '../../init-dependencies/event-store/get-all-events';
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
  let knownEvents = 0;
  return () => async () => {
    const events = await pipe(
      getAllEvents(eventStoreDb)(),
      TE.getOrElse(failure => {
        throw new Error(
          `unexpected Left from getAllEvents: ${failure.message} ${payloadToString(failure.payload)}`
        );
      })
    )();
    if (events.length > knownEvents) {
      events.slice(knownEvents - events.length).forEach(updateState);
      knownEvents = events.length;
    }
  };
};
