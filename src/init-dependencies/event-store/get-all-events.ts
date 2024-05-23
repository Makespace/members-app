import {pipe, flow} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import {internalCodecFailure} from '../../types/failureWithStatus';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {QueryEventsDatabase} from './query-events-database';
import {EventsTable} from './events-table';
import {eventsFromRows} from './events-from-rows';

export const getAllEvents =
  (queryDatabase: QueryEventsDatabase): Dependencies['getAllEvents'] =>
  () =>
    pipe(
      queryDatabase([{sql: 'SELECT * FROM events;', args: {}}]),
      TE.chainEitherK(
        flow(
          EventsTable.decode,
          E.mapLeft(internalCodecFailure('Failed to decode DB table'))
        )
      ),
      TE.map(table => table.rows),
      TE.chainEitherK(eventsFromRows)
    );
