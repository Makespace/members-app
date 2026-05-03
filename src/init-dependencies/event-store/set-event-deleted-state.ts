import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../../dependencies';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {dbExecute} from '../../util';

export const deleteEvent =
  (dbClient: Client): Dependencies['deleteEvent'] =>
  (eventIndex, deleteReason, markDeletedByMemberNumber) => TE.tryCatch(
    async () => {
      await dbExecute(
        dbClient,
        `
        INSERT OR REPLACE INTO deleted_events (event_index, deleted_at_unix_ms, delete_reason, mark_deleted_by_member_number)
        VALUES (?, ?, ?, ?);
        `,
        [eventIndex, Date.now(), deleteReason, markDeletedByMemberNumber]
      );
    },
    failureWithStatus(
      'Failed to update deleted state for event',
      StatusCodes.INTERNAL_SERVER_ERROR
    )
  );

export const unDeleteEvent =
  (dbClient: Client): Dependencies['unDeleteEvent'] =>
  (eventIndex) => TE.tryCatch(
    async () => {
      await dbExecute(
          dbClient,
          'DELETE FROM deleted_events WHERE event_index = ?;',
          [eventIndex]
      );
    },
    failureWithStatus(
      `Failed to undelete event ${eventIndex}`,
      StatusCodes.INTERNAL_SERVER_ERROR
    )
  );
