import {pipe, flow} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import {
  failureWithStatus,
  internalCodecFailure,
} from '../../types/failure-with-status';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {EventExclusionsTable, EventsTable} from './events-table';
import {eventsFromRows} from './events-from-rows';
import {Client} from '@libsql/client';
import {StatusCodes} from 'http-status-codes';
import {StoredDomainEvent, StoredEventOfType} from '../../types';
import {EventName} from '../../types/domain-event';
import {dbExecute} from '../../util';
import { exclusionEventsFromRows } from './exclusion-events-from-rows';
import { UUID } from 'io-ts-types';

export const getAllEvents =
  (dbClient: Client): Dependencies['getAllEvents'] =>
  () =>
    pipe(
      TE.tryCatch(
        () =>
          dbExecute(
            dbClient,
            `
            SELECT events.*
            FROM events
            LEFT JOIN events_exclusions ON events.id = events_exclusions.event_id
            WHERE events_exclusions.event_id IS NULL
            AND events.event_type != 'EquipmentTrainingQuizResult'
            `,
            {}
          ),
        failureWithStatus(
          'Failed to query database',
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      ),
      TE.chainEitherK(
        flow(
          EventsTable.decode,
          E.mapLeft(internalCodecFailure('Failed to decode DB table'))
        )
      ),
      TE.map(table => table.rows),
      TE.chainEitherK(eventsFromRows)
    );

export const getAllEventsByType =
  (dbClient: Client): Dependencies['getAllEventsByType'] =>
  <T extends EventName>(eventType: T) =>
    pipe(
      TE.tryCatch(
        () =>
          dbExecute(
            dbClient,
            `
            SELECT *
            FROM events
            LEFT JOIN events_exclusions ON events.id = events_exclusions.event_id
            WHERE events_exclusions.event_id IS NULL
            AND event_type = ?;
            `,
            [
              eventType,
            ]
          ),
        failureWithStatus(
          `Failed to query database for events of type '${eventType}'`,
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      ),
      TE.chainEitherK(
        flow(
          EventsTable.decode,
          E.mapLeft(
            internalCodecFailure(
              `Failed to decode db rows for event type '${eventType}'`
            )
          )
        )
      ),
      TE.map(table => table.rows),
      TE.chainEitherK(eventsFromRows),
      // This assumes that the DB has only returned events of the correct type.
      // This assumption avoids the need to do extra validation.
      // TODO - Pass codec to validate straight to eventsFromRows and get best of both.
      TE.map<
        ReadonlyArray<StoredDomainEvent>,
        ReadonlyArray<StoredEventOfType<T>>
      >(
        es => es as ReadonlyArray<StoredEventOfType<T>>
      )
    );

export const getAllEventsByTypes =
  (dbClient: Client) =>
  <T extends EventName, R extends EventName>(eventType: T, eventType2: R) =>
    pipe(
      TE.tryCatch(
        () =>
          dbExecute(
            dbClient,
            `
            SELECT *
            FROM events
            LEFT JOIN events_exclusions ON events.id = events_exclusions.event_id
            WHERE events_exclusions.event_id IS NULL
            AND (event_type = ? OR event_type = ?)
            `,
            [eventType, eventType2]
          ),
        failureWithStatus(
          `Failed to query database for events of type '${eventType}' + '${eventType2}'`,
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      ),
      TE.chainEitherK(
        flow(
          EventsTable.decode,
          E.mapLeft(
            internalCodecFailure(
              `Failed to decode db rows for event type '${eventType}' + '${eventType2}'`
            )
          )
        )
      ),
      TE.map(table => table.rows),
      TE.chainEitherK(eventsFromRows),
      // This assumes that the DB has only returned events of the correct type.
      // This assumption avoids the need to do extra validation.
      // TODO - Pass codec to validate straight to eventsFromRows and get best of both.
      TE.map<
        ReadonlyArray<StoredDomainEvent>,
        ReadonlyArray<StoredEventOfType<T> | StoredEventOfType<R>>
      >(
        es =>
          es as ReadonlyArray<StoredEventOfType<T> | StoredEventOfType<R>>
      )
    );

export const getAllExclusionEvents = (dbClient: Client): Dependencies['getAllExclusionEvents'] =>
  () =>
    pipe(
      TE.tryCatch(
        () =>
          dbExecute(
            dbClient,
            `
            SELECT events_exclusions.*, events.payload, events.event_type
            FROM events_exclusions
            INNER JOIN events ON events.id = events_exclusions.event_id
            `,
            {}
          ),
        failureWithStatus(
          'Failed to query database',
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      ),
      TE.chainEitherK(
        flow(
          EventExclusionsTable.decode,
          E.mapLeft(internalCodecFailure('Failed to decode event exclusions DB table'))
        )
      ),
      TE.map(table => table.rows),
      TE.chainEitherK(exclusionEventsFromRows)
    );

export const getEventById = (dbClient: Client): Dependencies['getEventById'] =>
    (event_id: UUID) =>
        pipe(
          TE.tryCatch(
            () =>
              dbExecute(
                dbClient,
                `
                SELECT events.*
                FROM events
                WHERE events.id = ?
                `,
                [event_id]
              ),
            failureWithStatus(
              'Failed to query database',
              StatusCodes.INTERNAL_SERVER_ERROR
            )
          ),
          TE.chainEitherK(
            flow(
              EventsTable.decode,
              E.mapLeft(internalCodecFailure('Failed to decode DB table'))
            )
          ),
          TE.map(table => table.rows),
          TE.chainEitherK(eventsFromRows),
          TE.map(
            RA.match(
              () => O.none,
              (events) => O.some(events[0])
            )
          )
        );
