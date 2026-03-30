import {pipe, flow} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import {
  failureWithStatus,
  internalCodecFailure,
} from '../../types/failure-with-status';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {EventsTable} from './events-table';
import {eventsFromRows} from './events-from-rows';
import {Client} from '@libsql/client';
import {StatusCodes} from 'http-status-codes';
import {StoredDomainEvent, StoredEventOfType} from '../../types';
import {EventName} from '../../types/domain-event';
import {dbExecute} from '../../util';
import {EventsWithDeletionsTable} from './events-with-deletions-table';
import {eventsWithDeletionsFromRows} from './events-with-deletions-from-rows';

const activeEventsClause = `
  NOT EXISTS (
    SELECT 1
    FROM deleted_events
    WHERE deleted_events.event_id = events.id
  )
`;

export const getAllEvents =
  (dbClient: Client): Dependencies['getAllEvents'] =>
  () =>
    pipe(
      TE.tryCatch(
        () =>
          dbExecute(
            dbClient,
            `SELECT * FROM events
             WHERE event_type != 'EquipmentTrainingQuizResult'
               AND ${activeEventsClause}
             ORDER BY event_index ASC`,
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

export const getAllEventsWithDeletionStatus =
  (dbClient: Client): Dependencies['getAllEventsWithDeletionStatus'] =>
  () =>
    pipe(
      TE.tryCatch(
        () =>
          dbExecute(
            dbClient,
            `SELECT
               events.*,
               deleted_events.deleted_at,
               deleted_events.deleted_by_member_number,
               deleted_events.deletion_reason
             FROM events
             LEFT JOIN deleted_events
               ON deleted_events.event_id = events.id
             WHERE event_type != 'EquipmentTrainingQuizResult'
             ORDER BY event_index ASC`,
            {}
          ),
        failureWithStatus(
          'Failed to query database',
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      ),
      TE.chainEitherK(
        flow(
          EventsWithDeletionsTable.decode,
          E.mapLeft(
            internalCodecFailure('Failed to decode DB rows with deletion status')
          )
        )
      ),
      TE.map(table => table.rows),
      TE.chainEitherK(eventsWithDeletionsFromRows)
    );

export const getAllEventsByType =
  (dbClient: Client): Dependencies['getAllEventsByType'] =>
  <T extends EventName>(eventType: T) =>
    pipe(
      TE.tryCatch(
        () =>
          dbExecute(
            dbClient,
            `SELECT * FROM events
             WHERE event_type = ?
               AND ${activeEventsClause}
             ORDER BY event_index ASC;`,
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
            `SELECT * FROM events
             WHERE (event_type = ? OR event_type = ?)
               AND ${activeEventsClause}
             ORDER BY event_index ASC`,
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
