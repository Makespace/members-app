import {Client} from '@libsql/client';
import {getAllEventsAfterEventIndex} from '../../init-dependencies/event-store/get-all-events';
import {pipe} from 'fp-ts/lib/function';
import {StoredDomainEvent} from '../../types';
import * as TE from 'fp-ts/TaskEither';
import {startSpan} from '@sentry/node';

function payloadToString(payload: unknown): string {
  return JSON.stringify(payload);
}

export const asyncRefresh = (
  eventStoreDb: Client,
  getCurrentEventIndex: () => number,
  updateState: (event: StoredDomainEvent) => void
) => {
  return () => async () => {
    await startSpan(
      {
        name: 'Refresh read-model',
        op: 'refresh.read-model',
      },
      async () => {
        const currentIndex = getCurrentEventIndex();
        const events = await pipe(
          currentIndex,
          getAllEventsAfterEventIndex(eventStoreDb),
          TE.getOrElse(failure => {
            throw new Error(
              `unexpected Left from getAllEvents: ${failure.message} ${payloadToString(failure.payload)}`
            );
          })
        )();
        events.forEach(updateState);
      }
    );
  };
};
