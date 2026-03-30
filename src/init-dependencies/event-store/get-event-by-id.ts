import {pipe, flow} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import {
  failureWithStatus,
  internalCodecFailure,
} from '../../types/failure-with-status';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {EventsTable} from './events-table';
import {eventsFromRows} from './events-from-rows';
import {Client} from '@libsql/client';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {dbExecute} from '../../util';

export const getEventById =
  (dbClient: Client): Dependencies['getEventById'] =>
  (eventId: UUID) =>
    pipe(
      TE.tryCatch(
        () =>
          dbExecute(
            dbClient,
            'SELECT * FROM events WHERE id = ?;',
            [eventId]
          ),
        failureWithStatus(
          `Failed to query database for event '${eventId}'`,
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      ),
      TE.chainEitherK(
        flow(
          EventsTable.decode,
          E.mapLeft(
            internalCodecFailure(
              `Failed to decode db rows for event '${eventId}'`
            )
          )
        )
      ),
      TE.map(table => table.rows),
      TE.chainEitherK(rows =>
        rows.length > 1
          ? E.left(
              failureWithStatus(
                `Found multiple events with id '${eventId}'`,
                StatusCodes.INTERNAL_SERVER_ERROR
              )()
            )
          : pipe(
              rows,
              eventsFromRows,
              E.map(events => O.fromNullable(events[0]))
            )
      )
    );
