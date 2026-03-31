import {Client} from '@libsql/client';
import * as E from 'fp-ts/Either';
import * as RA from 'fp-ts/ReadonlyArray';
import * as TE from 'fp-ts/TaskEither';
import {flow, pipe} from 'fp-ts/lib/function';
import * as tt from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../../dependencies';
import {DeletedEvent} from '../../types';
import {Actor} from '../../types/actor';
import {
  FailureWithStatus,
  failureWithStatus,
  internalCodecFailure,
} from '../../types/failure-with-status';
import {dbExecute} from '../../util';
import {DeletedEventsTable} from './deleted-events-table';

const deletedEventRowFailure = failureWithStatus(
  'Failed to decode deleted event rows',
  StatusCodes.INTERNAL_SERVER_ERROR
);

const decodeDeletedBy = (
  deletedBy: string
): E.Either<FailureWithStatus, DeletedEvent['deletedBy']> =>
  pipe(
    E.tryCatch(
      (): unknown => JSON.parse(deletedBy),
      error => deletedEventRowFailure(error)
    ),
    E.chain(value =>
      pipe(
        value,
        Actor.decode,
        E.mapLeft(internalCodecFailure(deletedEventRowFailure().message))
      )
    )
  );

const deletedEventFromRow = (
  row: DeletedEventsTable['rows'][number]
): E.Either<FailureWithStatus, DeletedEvent> =>
  pipe(
    E.Do,
    E.bind('event_id', () =>
      pipe(
        row.event_id,
        tt.UUID.decode,
        E.mapLeft(internalCodecFailure(deletedEventRowFailure().message))
      )
    ),
    E.bind('deletedAt', () =>
      pipe(
        row.deleted_at,
        tt.DateFromISOString.decode,
        E.mapLeft(internalCodecFailure(deletedEventRowFailure().message))
      )
    ),
    E.bind('deletedBy', () => decodeDeletedBy(row.deleted_by)),
    E.bind('reason', () =>
      pipe(
        row.reason,
        tt.NonEmptyString.decode,
        E.mapLeft(internalCodecFailure(deletedEventRowFailure().message))
      )
    )
  );

const deletedEventsFromRows = (
  rows: DeletedEventsTable['rows']
): E.Either<FailureWithStatus, ReadonlyArray<DeletedEvent>> =>
  pipe(rows, RA.traverse(E.Applicative)(deletedEventFromRow));

export const getDeletedEvents = (
  dbClient: Client
): TE.TaskEither<FailureWithStatus, ReadonlyArray<DeletedEvent>> =>
  pipe(
    TE.tryCatch(
      () =>
        dbExecute(
          dbClient,
          'SELECT * FROM deleted_events ORDER BY deleted_at ASC;',
          {}
        ),
      failureWithStatus(
        'Failed to query database for deleted events',
        StatusCodes.INTERNAL_SERVER_ERROR
      )
    ),
    TE.chainEitherK(
      flow(
        DeletedEventsTable.decode,
        E.mapLeft(internalCodecFailure('Failed to decode deleted events table'))
      )
    ),
    TE.map(table => table.rows),
    TE.chainEitherK(deletedEventsFromRows)
  );

export const getDeletedEventById =
  (dbClient: Client): Dependencies['getDeletedEventById'] =>
  eventId =>
    pipe(
      getDeletedEvents(dbClient),
      TE.map(RA.findFirst(deletedEvent => deletedEvent.event_id === eventId))
    );
