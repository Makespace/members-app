/* eslint-disable unused-imports/no-unused-vars */
import {Client} from '@libsql/client/.';
import {getAllEvents} from '../../init-dependencies/event-store/get-all-events';
import {pipe} from 'fp-ts/lib/function';
import {DomainEvent} from '../../types';
import * as TE from 'fp-ts/TaskEither';
import {Span, startSpan} from '@sentry/node';

function payloadToString(payload: unknown): string {
  return JSON.stringify(payload);
}

export const asyncRefresh = (
  eventStoreDb: Client,
  updateState: (event: DomainEvent) => void
) => {
  let knownEvents = 0;
  return () => () =>
    startSpan(
      {
        name: 'Async Refresh',
        attributes: {
          known_events_before: knownEvents,
        },
      },
      async (parentSpan: Span) => {
        const events = await startSpan(
          {name: 'Get All Events'},
          async (span: Span) => {
            const result = await pipe(
              getAllEvents(eventStoreDb)(),
              TE.getOrElse(failure => {
                throw new Error(
                  `unexpected Left from getAllEvents: ${failure.message} ${payloadToString(failure.payload)}`
                );
              })
            )();
            span.setAttribute('event_count', result.length);
            return result;
          }
        );

        if (events.length > knownEvents) {
          events.slice(knownEvents - events.length).forEach(updateState);
          knownEvents = events.length;
        }
        parentSpan.setAttribute('known_events_after', knownEvents);
      }
    );
};
