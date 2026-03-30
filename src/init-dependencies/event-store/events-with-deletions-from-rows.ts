import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import type {NonEmptyString} from 'io-ts-types';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import type {StoredEventDeletion} from '../../types/stored-event-deletion';
import type {StoredEventLogEntry} from '../../types/stored-event-log-entry';
import {eventsFromRows} from './events-from-rows';
import {EventsWithDeletionsTable} from './events-with-deletions-table';

const invalidDeletionMetadata = () =>
  failureWithStatus(
    'Failed to get events with deletion status from DB',
    500
  )();

const isDeletedRow = (
  row: EventsWithDeletionsTable['rows'][number]
): row is EventsWithDeletionsTable['rows'][number] & {
  deleted_at: string;
  deleted_by_member_number: number;
  deletion_reason: string;
} =>
  row.deleted_at !== null &&
  row.deleted_by_member_number !== null &&
  row.deletion_reason !== null;

const entryFromRow = (
  row: EventsWithDeletionsTable['rows'][number]
): E.Either<FailureWithStatus, StoredEventLogEntry> =>
  pipe(
    eventsFromRows([row]),
    E.chain(events => {
      const event = events[0];

      if (
        row.deleted_at === null &&
        row.deleted_by_member_number === null &&
        row.deletion_reason === null
      ) {
        return E.right({
          ...event,
          deletion: null,
        } as StoredEventLogEntry);
      }

      if (!isDeletedRow(row)) {
        return E.left(invalidDeletionMetadata());
      }

      return E.right({
        ...event,
        deletion: {
          eventId: event.event_id,
          deletedAt: new Date(row.deleted_at),
          deletedByMemberNumber: row.deleted_by_member_number,
          reason: row.deletion_reason as NonEmptyString,
        } satisfies StoredEventDeletion,
      } as StoredEventLogEntry);
    })
  );

export const eventsWithDeletionsFromRows = (
  rows: EventsWithDeletionsTable['rows']
): E.Either<FailureWithStatus, ReadonlyArray<StoredEventLogEntry>> =>
  pipe(rows, E.traverseArray(entryFromRow));
