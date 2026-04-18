import {Logger} from 'pino';
import {v4 as uuidv4} from 'uuid';
import {Client} from '@libsql/client';
import {DomainEvent} from '../../types';
import {dbExecute} from '../../util';
import * as TE from 'fp-ts/TaskEither';
import { failureWithStatus, FailureWithStatus } from '../../types/failure-with-status';
import { pipe } from 'fp-ts/lib/function';
import { StatusCodes } from 'http-status-codes';
import { Int } from 'io-ts';

const insertEventRow = `
    INSERT INTO events
    (id, event_index, event_type, payload)
    VALUES (?, ?, ?, ?);
  `;

export const insertEventWithOptimisticConcurrencyControl = (
  event: DomainEvent,
  lastSeenEventIndex: Int,
  eventDB: Client
): TE.TaskEither<FailureWithStatus, 'raised-event' | 'last-known-version-out-of-date'> => pipe(
  TE.tryCatch<Error, 'raised-event' | 'last-known-version-out-of-date'>(
    () => dbExecute(
      eventDB,
      insertEventRow,
      [
        uuidv4(),
        lastSeenEventIndex + 1,
        event.type,
        JSON.stringify(event)
      ]
    ).then(_res => 'raised-event'),
    (err) => {
      return err as Error;
    }
  ),
  TE.orElse<Error, 'raised-event' | 'last-known-version-out-of-date', FailureWithStatus>(err => {
    if ('code' in err && err['code'] === 'SQLITE_CONSTRAINT_UNIQUE') {
      return TE.right('last-known-version-out-of-date');
    }
    return TE.left(failureWithStatus(
      'Failed to insert event into database',
      StatusCodes.INTERNAL_SERVER_ERROR
    )(err));
  }),
);
