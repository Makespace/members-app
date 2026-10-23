import {v4 as uuidv4} from 'uuid';
import {Client} from '@libsql/client';
import * as E from 'fp-ts/Either';
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

// Another event already took this event_index: someone else committed first.
// A local SQLite database reports the extended code SQLITE_CONSTRAINT_UNIQUE,
// but Turso (production) reports just SQLITE_CONSTRAINT, so match either.
const isConstraintViolation = (err: Error) =>
  'code' in err &&
  typeof err['code'] === 'string' &&
  err['code'].startsWith('SQLITE_CONSTRAINT');

// An Error's own fields don't survive JSON logging (it logs as {}), so log
// what explains the failure.
const describeError = (err: Error) => ({
  name: err.name,
  message: err.message,
  ...('code' in err ? {code: err['code']} : {}),
});

// An event is only stored if it reads back: one that doesn't (e.g. a number
// too big for JSON, stored as null) would stop the read model loading every
// event after it, and the app starting.
const storablePayload = (
  event: DomainEvent
): E.Either<FailureWithStatus, string> => {
  const payload = JSON.stringify(event);
  return pipe(
    DomainEvent.decode(JSON.parse(payload)),
    E.bimap(
      () =>
        failureWithStatus(
          'Some of what was entered could not be saved. Please check the numbers are sensible.',
          StatusCodes.BAD_REQUEST
        )({type: event.type}),
      () => payload
    )
  );
};

export const insertEventWithOptimisticConcurrencyControl = (
  event: DomainEvent,
  lastSeenEventIndex: Int,
  eventDB: Client
): TE.TaskEither<FailureWithStatus, 'raised-event' | 'last-known-version-out-of-date'> => pipe(
  TE.fromEither(storablePayload(event)),
  TE.chain(payload => pipe(TE.tryCatch<Error, 'raised-event' | 'last-known-version-out-of-date'>(
    () => dbExecute(
      eventDB,
      insertEventRow,
      [
        uuidv4(),
        lastSeenEventIndex + 1,
        event.type,
        payload
      ]
    ).then(_res => 'raised-event'),
    (err) => {
      return err as Error;
    }
  ),
  TE.orElse<Error, 'raised-event' | 'last-known-version-out-of-date', FailureWithStatus>(err => {
    if (isConstraintViolation(err)) {
      return TE.right('last-known-version-out-of-date');
    }
    return TE.left(failureWithStatus(
      'Failed to insert event into database',
      StatusCodes.INTERNAL_SERVER_ERROR
    )(describeError(err)));
  }))),
);
