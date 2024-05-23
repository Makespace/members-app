import {pipe, flow} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import {
  failureWithStatus,
  internalCodecFailure,
} from '../../types/failureWithStatus';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {EventsTable} from './events-table';
import {eventsFromRows} from './events-from-rows';
import {Client} from '@libsql/client/.';
import {StatusCodes} from 'http-status-codes';

export const getAllEvents =
  (dbClient: Client): Dependencies['getAllEvents'] =>
  () =>
    pipe(
      TE.tryCatch(
        () => dbClient.execute({sql: 'SELECT * FROM events;', args: {}}),
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
