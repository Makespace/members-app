import {flow, pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import {QueryEventsDatabase} from './query-events-database';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as tt from 'io-ts-types';
import * as t from 'io-ts';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {DomainEvent} from '../../types';
import {failureWithStatus} from '../../types/failureWithStatus';
import {sequenceS} from 'fp-ts/lib/Apply';
import {EventsTable} from './events-table';

const reshapeRowToEvent = (row: EventsTable['rows'][number]) =>
  pipe(
    row.payload,
    tt.JsonFromString.decode,
    E.chain(tt.JsonRecord.decode),
    E.map(payload => ({
      type: row.event_type,
      ...payload,
    }))
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
          E.mapLeft(formatValidationErrors),
          E.mapLeft(
            failureWithStatus(
              'failed to decode db response',
              StatusCodes.INTERNAL_SERVER_ERROR
            )
          )
        )
      ),
      TE.map(response => response.rows),
      TE.chainEitherK(rows =>
        pipe(
          {
            version: E.right(0),
            events: pipe(
              rows,
              E.traverseArray(reshapeRowToEvent),
              foo => foo,
              E.chain(t.readonlyArray(DomainEvent).decode),
              E.mapLeft(formatValidationErrors),
              E.mapLeft(
                failureWithStatus(
                  'failed to decode events',
                  StatusCodes.INTERNAL_SERVER_ERROR
                )
              )
            ),
          },
          sequenceS(E.Apply)
        )
      ),
      TE.mapLeft(
        failureWithStatus(
          'Failed to get events from DB',
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      ),
      foo => foo
    );
