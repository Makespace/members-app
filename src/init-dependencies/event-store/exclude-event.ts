import {StatusCodes} from 'http-status-codes';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../../dependencies';
import {v4 as uuidv4} from 'uuid';
import {Client} from '@libsql/client';
import {dbExecute} from '../../util';

const insertEventExclusionRow = `
    INSERT INTO events_exclusions
    (id, event_id, reverted_by_member_number, revert_reason, reverted_at_timestamp_epoch_ms)
    VALUES (?, ?, ?, ?, ?);
  `;

// This should only be used where an event needs to be 'deleted'.
// This should not be used to 'undo' something. Its expected that there will only be a few
// cases where this is used.
export const excludeEvent =
  (
    eventDB: Client,
  ): Dependencies['excludeEvent'] =>
  (
    event_id: string,
    reverted_by_number: number,
    revert_reason: string
  ): TE.TaskEither<FailureWithStatus, unknown> => TE.tryCatch(
    () =>
      dbExecute(
        eventDB,
        insertEventExclusionRow,
        [
          uuidv4(),
          event_id,
          reverted_by_number,
          revert_reason,
          Date.now(),
        ]
      ),
    failureWithStatus(
      'Failed to exclude event',
      StatusCodes.INTERNAL_SERVER_ERROR
    )
  );
