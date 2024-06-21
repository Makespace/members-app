import {flow, pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {
  failureWithStatus,
  internalCodecFailure,
} from '../../types/failure-with-status';
import {sequenceS} from 'fp-ts/lib/Apply';
import {EventsTable} from './events-table';
import {eventsFromRows} from './events-from-rows';
import * as RA from 'fp-ts/ReadonlyArray';
import {Client} from '@libsql/client/.';
import {StatusCodes} from 'http-status-codes';

const getLatestVersion = (rows: EventsTable['rows']) =>
  pipe(
    rows,
    RA.map(row => row.resource_version),
    RA.reduce(0, (max, version) => (version > max ? version : max))
  );

export const getResourceEvents =
  (dbClient: Client): Dependencies['getResourceEvents'] =>
  resource =>
    pipe(
      TE.tryCatch(
        () =>
          dbClient.execute({
            sql: 'SELECT * FROM events WHERE resource_type = ? AND resource_id = ?;',
            args: [resource.type, resource.id],
          }),
        failureWithStatus(
          'Failed to query database',
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      ),
      TE.chainEitherK(
        flow(
          EventsTable.decode,
          E.mapLeft(internalCodecFailure('failed to decode db response'))
        )
      ),
      TE.map(response => response.rows),
      TE.chainEitherK(rows =>
        pipe(
          {
            version: E.right(getLatestVersion(rows)),
            events: eventsFromRows(rows),
          },
          sequenceS(E.Apply)
        )
      )
    );
