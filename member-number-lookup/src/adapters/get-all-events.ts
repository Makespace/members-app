import {pipe, flow} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {Dependencies} from '../dependencies';
import {DomainEvent} from '../types';
import {failureWithStatus} from '../types/failureWithStatus';
import {QueryDatabase} from './query-database';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as tt from 'io-ts-types';
import * as t from 'io-ts';

const EventsFromDb = t.readonlyArray(
  t.strict({
    id: t.string,
    resource_id: t.string,
    resource_type: t.string,
    event_type: t.string,
    payload: t.string,
  })
);

type EventsFromDb = t.TypeOf<typeof EventsFromDb>;

const reshapeRowToEvent = (row: EventsFromDb[number]) =>
  pipe(
    row.payload,
    tt.JsonFromString.decode,
    E.chain(tt.JsonRecord.decode),
    E.map(payload => ({
      type: row.event_type,
      ...payload,
    }))
  );

export const getAllEvents =
  (queryDatabase: QueryDatabase): Dependencies['getAllEvents'] =>
  () =>
    pipe(
      queryDatabase('SELECT * FROM events;', []),
      TE.chainEitherK(
        flow(
          EventsFromDb.decode,
          E.chain(E.traverseArray(reshapeRowToEvent)),
          E.chain(t.readonlyArray(DomainEvent).decode),
          E.mapLeft(formatValidationErrors),
          E.mapLeft(
            failureWithStatus(
              'Failed to get events from DB',
              StatusCodes.INTERNAL_SERVER_ERROR
            )
          )
        )
      )
    );
