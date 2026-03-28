import {pipe} from 'fp-ts/lib/function';
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
import {Client} from '@libsql/client';
import {StatusCodes} from 'http-status-codes';
import {dbExecute} from '../../util';

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
      {
        versionRows: TE.tryCatch(
          () =>
            dbExecute(
              dbClient,
              'SELECT * FROM events WHERE resource_type = ? AND resource_id = ?;',
              [resource.type, resource.id]
            ),
          failureWithStatus(
            'Failed to query database',
            StatusCodes.INTERNAL_SERVER_ERROR
          )
        ),
        eventRows: TE.tryCatch(
          () =>
            dbExecute(
              dbClient,
              `
              SELECT events.*
              FROM events
              LEFT JOIN events_exclusions ON events.id = events_exclusions.event_id
              WHERE events.resource_type = ?
              AND events.resource_id = ?
              AND events_exclusions.event_id IS NULL;
              `,
              [resource.type, resource.id]
            ),
          failureWithStatus(
            'Failed to query database',
            StatusCodes.INTERNAL_SERVER_ERROR
          )
        )
      },
      sequenceS(TE.ApplyPar),
      TE.chainEitherK(({versionRows, eventRows}) =>
        pipe(
          {
            version: pipe(
              versionRows,
              EventsTable.decode,
              E.mapLeft(internalCodecFailure('failed to decode db response')),
              E.map(response => getLatestVersion(response.rows))
            ),
            events: pipe(
              eventRows,
              EventsTable.decode,
              E.mapLeft(internalCodecFailure('failed to decode db response')),
              E.chain(response => eventsFromRows(response.rows))
            ),
          },
          sequenceS(E.Apply)
        )
      )
    );
