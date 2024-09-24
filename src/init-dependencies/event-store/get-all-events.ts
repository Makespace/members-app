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
import {Client} from '@libsql/client/.';
import {StatusCodes} from 'http-status-codes';
import {DomainEvent} from '../../types';
import {EventName, EventOfType} from '../../types/domain-event';

export const getAllEvents =
  (dbClient: Client): Dependencies['getAllEvents'] =>
  () =>
    pipe(
      TE.tryCatch(
        () => {
          console.log('Getting all events...');
          const result = dbClient.execute({
            sql: "SELECT * FROM events WHERE event_type != 'EquipmentTrainingQuizResult'",
            args: {},
          });
          console.log('Got all events');
          return result;
        },
        failureWithStatus(
          'Failed to query database',
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      ),
      TE.chainEitherK(raw => {
        console.log('Decoding events table');
        const result = flow(
          EventsTable.decode,
          E.mapLeft(internalCodecFailure('Failed to decode DB table'))
        )(raw);
        console.log('Decoded result');
        console.log(result);
        return result;
      }),
      TE.map(table => table.rows),
      TE.chainEitherK(eventsFromRows)
    );

export const getAllEventsByType =
  (dbClient: Client): Dependencies['getAllEventsByType'] =>
  <T extends EventName>(eventType: T) =>
    pipe(
      TE.tryCatch(
        () =>
          dbClient.execute({
            sql: 'SELECT * FROM events WHERE event_type = ?;',
            args: [eventType],
          }),
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
      TE.map<ReadonlyArray<DomainEvent>, ReadonlyArray<EventOfType<T>>>(
        es => es as ReadonlyArray<EventOfType<T>>
      )
    );
