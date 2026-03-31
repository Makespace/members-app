import {Client, InArgs} from '@libsql/client';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as TE from 'fp-ts/TaskEither';
import {flow, pipe} from 'fp-ts/lib/function';
import {sequenceS} from 'fp-ts/lib/Apply';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../../dependencies';
import {
  DeletedEvent,
  StoredDomainEvent,
  StoredDomainEventWithDeletion,
  StoredEventOfType,
} from '../../types';
import {EventName} from '../../types/domain-event';
import {
  FailureWithStatus,
  failureWithStatus,
  internalCodecFailure,
} from '../../types/failure-with-status';
import {dbExecute} from '../../util';
import {getDeletedEvents} from './get-deleted-events';
import {eventsFromRows} from './events-from-rows';
import {EventsTable} from './events-table';

const getEvents =
  (dbClient: Client) => (
    sql: string,
    args: InArgs,
    errorMessage: string
  ): TE.TaskEither<
    FailureWithStatus,
    {
      events: ReadonlyArray<StoredDomainEvent>;
      deletedEvents: ReadonlyArray<DeletedEvent>;
    }
  > =>
    pipe(
      {
        events: pipe(
          TE.tryCatch(
            () => dbExecute(dbClient, sql, args),
            failureWithStatus(errorMessage, StatusCodes.INTERNAL_SERVER_ERROR)
          ),
          TE.chainEitherK(
            flow(
              EventsTable.decode,
              E.mapLeft(internalCodecFailure('Failed to decode DB table'))
            )
          ),
          TE.map(table => table.rows),
          TE.chainEitherK(eventsFromRows)
        ),
        deletedEvents: getDeletedEvents(dbClient),
      },
      sequenceS(TE.ApplyPar)
    );

const withDeletionMetadata = ({
  events,
  deletedEvents,
}: {
  events: ReadonlyArray<StoredDomainEvent>;
  deletedEvents: ReadonlyArray<DeletedEvent>;
}): ReadonlyArray<StoredDomainEventWithDeletion> =>
  pipe(
    events,
    RA.map(event => ({
      ...event,
      deleted: pipe(
        deletedEvents,
        RA.findFirst(deletedEvent => deletedEvent.event_id === event.event_id),
        O.getOrElseW(() => null)
      ),
    }))
  );

const withoutDeletedEvents = (
  events: ReadonlyArray<StoredDomainEventWithDeletion>
): ReadonlyArray<StoredDomainEvent> =>
  pipe(
    events,
    RA.filter(event => event.deleted === null),
    RA.map(({deleted: _deleted, ...event}) => event)
  );

export const getAllEvents =
  (dbClient: Client): Dependencies['getAllEvents'] =>
  () =>
    pipe(
      getEvents(dbClient)(
        "SELECT * FROM events WHERE event_type != 'EquipmentTrainingQuizResult' ORDER BY event_index ASC",
        [],
        'Failed to query database'
      ),
      TE.map(withDeletionMetadata),
      TE.map(withoutDeletedEvents)
    );

export const getAllEventsIncludingDeleted =
  (dbClient: Client): Dependencies['getAllEventsIncludingDeleted'] =>
  () =>
    pipe(
      getEvents(dbClient)(
        "SELECT * FROM events WHERE event_type != 'EquipmentTrainingQuizResult' ORDER BY event_index ASC",
        [],
        'Failed to query database'
      ),
      TE.map(withDeletionMetadata)
    );

export const getAllEventsByType =
  (dbClient: Client): Dependencies['getAllEventsByType'] =>
  <T extends EventName>(eventType: T) =>
    pipe(
      getEvents(dbClient)(
        'SELECT * FROM events WHERE event_type = ? ORDER BY event_index ASC;',
        [eventType],
        `Failed to query database for events of type '${eventType}'`
      ),
      TE.map(withDeletionMetadata),
      TE.map(withoutDeletedEvents),
      TE.map<
        ReadonlyArray<StoredDomainEvent>,
        ReadonlyArray<StoredEventOfType<T>>
      >(events => events as ReadonlyArray<StoredEventOfType<T>>)
    );

export const getAllEventsByTypes =
  (dbClient: Client) =>
  <T extends EventName, R extends EventName>(eventType: T, eventType2: R) =>
    pipe(
      getEvents(dbClient)(
        'SELECT * FROM events WHERE event_type = ? OR event_type = ? ORDER BY event_index ASC',
        [eventType, eventType2],
        `Failed to query database for events of type '${eventType}' + '${eventType2}'`
      ),
      TE.map(withDeletionMetadata),
      TE.map(withoutDeletedEvents),
      TE.map<
        ReadonlyArray<StoredDomainEvent>,
        ReadonlyArray<StoredEventOfType<T> | StoredEventOfType<R>>
      >(
        events =>
          events as ReadonlyArray<StoredEventOfType<T> | StoredEventOfType<R>>
      )
    );
