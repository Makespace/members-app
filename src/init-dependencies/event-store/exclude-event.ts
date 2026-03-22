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

const insertEventRow = `
    INSERT INTO events_exclusions
    (id, event_id, reverted_by_number, revert_reason)
    SELECT ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT * FROM events
      WHERE resource_id = ?
        AND resource_type = ?
        AND resource_version = ?
    );
  `;
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
        insertEventRow,
        [
          uuidv4(),
          event_id,
          reverted_by_number,
          revert_reason,
        ]
      ),
    failureWithStatus(
      'Failed to execlude event',
      StatusCodes.INTERNAL_SERVER_ERROR
    )
  );
