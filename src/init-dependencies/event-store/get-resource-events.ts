import {flow, pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import {QueryEventsDatabase} from './query-events-database';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {internalCodecFailure} from '../../types/failureWithStatus';
import {sequenceS} from 'fp-ts/lib/Apply';
import {EventsTable} from './events-table';
import {eventsFromRows} from './events-from-rows';
import * as RA from 'fp-ts/ReadonlyArray';

const getLatestVersion = (rows: EventsTable['rows']) =>
  pipe(
    rows,
    RA.map(row => row.resource_version),
    RA.reduce(0, (max, version) => (version > max ? version : max))
  );

export const getResourceEvents =
  (
    queryEventsDatabase: QueryEventsDatabase
  ): Dependencies['getResourceEvents'] =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
  resource =>
    pipe(
      queryEventsDatabase([{sql: 'SELECT * FROM events;', args: {}}]),
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
