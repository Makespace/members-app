import {Client} from '@libsql/client';
import {getAllEventsAfterEventIndex} from '../../init-dependencies/event-store/get-all-events';
import {pipe} from 'fp-ts/lib/function';
import {StoredDomainEvent} from '../../types';
import * as TE from 'fp-ts/TaskEither';
import {Logger} from 'pino';
import {performance} from 'node:perf_hooks';

function payloadToString(payload: unknown): string {
  return JSON.stringify(payload);
}

export const asyncRefresh = (
  eventStoreDb: Client,
  getCurrentEventIndex: () => number,
  updateState: (event: StoredDomainEvent) => void,
  logger: Logger
) => {
  return () => async () => {
    const refreshStartedAt = performance.now();
    const startEventIndex = getCurrentEventIndex();
    const fetchStartedAt = performance.now();
    const events = await pipe(
      startEventIndex,
      getAllEventsAfterEventIndex(eventStoreDb),
      TE.getOrElse(failure => {
        throw new Error(
          `unexpected Left from getAllEvents: ${failure.message} ${payloadToString(failure.payload)}`
        );
      })
    )();
    const fetchDurationMs = performance.now() - fetchStartedAt;

    const projectionStartedAt = performance.now();
    events.forEach(updateState);
    const projectionDurationMs = performance.now() - projectionStartedAt;

    logger.info(
      {
        eventCount: events.length,
        startEventIndex,
        endEventIndex: getCurrentEventIndex(),
        fetchDurationMs,
        projectionDurationMs,
        totalDurationMs: performance.now() - refreshStartedAt,
      },
      'Read model refresh completed'
    );
  };
};
