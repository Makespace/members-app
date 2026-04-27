import {pipe, flow} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import {
  failureWithStatus,
  internalCodecFailure,
} from '../../types/failure-with-status';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {EventsTable} from './events-table';
import {deletedEventsFromRows, eventsFromRows} from './events-from-rows';
import {Client} from '@libsql/client';
import {StatusCodes} from 'http-status-codes';
import {
  StoredDomainEvent,
  StoredEventOfType,
} from '../../types';
import {EventName} from '../../types/domain-event';
import {dbExecute} from '../../util';


export const getAllEvents =
  (dbClient: Client): Dependencies['getAllEvents'] => () => getAllEventsAfterEventIndex(dbClient)(0);

export const getAllEventsAfterEventIndex =
  (dbClient: Client) => (eventIndex: number) =>
    pipe(
      TE.tryCatch(
        () =>
          dbExecute(
            dbClient,
            `SELECT
              events.*
            FROM events
              LEFT JOIN deleted_events
                ON deleted_events.event_index = events.event_index
              WHERE event_type != 'EquipmentTrainingQuizResult'
                AND deleted_events.event_index IS NULL
                AND events.event_index > ?
            ORDER BY events.event_index ASC`,
            [eventIndex]
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

export const getDeletedEvents =
  (dbClient: Client): Dependencies['getDeletedEvents'] =>
  () =>
    pipe(
      TE.tryCatch(
        () =>
          dbExecute(
            dbClient,
            `
            SELECT events.*, deleted_events.deleted_at
            FROM events
            INNER JOIN deleted_events
              ON deleted_events.event_index = events.event_index
            WHERE event_type != 'EquipmentTrainingQuizResult'
            ORDER BY events.event_index ASC
            `,
            {}
          ),
        failureWithStatus(
          'Failed to query deleted events from database',
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
      TE.chainEitherK(deletedEventsFromRows)
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
            SELECT events.*
            FROM events
            LEFT JOIN deleted_events
              ON deleted_events.event_index = events.event_index
            WHERE deleted_events.event_index IS NULL
              AND event_type = ?
            ORDER BY events.event_index ASC;
            `,
            [eventType]
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
            SELECT events.*
            FROM events
            LEFT JOIN deleted_events
              ON deleted_events.event_index = events.event_index
            WHERE deleted_events.event_index IS NULL
              AND (event_type = ? OR event_type = ?)
            ORDER BY events.event_index ASC
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
