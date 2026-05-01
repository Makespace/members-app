import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../../dependencies';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {dbExecute} from '../../util';

export const setEventDeletedState =
  (dbClient: Client): Dependencies['setEventDeletedState'] =>
  (eventIndex, deleted) => TE.tryCatch(
    async () => {
      deleted
      ? await dbExecute(
          dbClient,
          `
          INSERT OR REPLACE INTO deleted_events (event_index, deleted_at)
          VALUES (?, ?);
          `,
          [eventIndex, new Date().toISOString()]
        )
      : await dbExecute(
          dbClient,
          'DELETE FROM deleted_events WHERE event_index = ?;',
          [eventIndex]
      );
    },
    failureWithStatus(
      'Failed to update deleted state for event',
      StatusCodes.INTERNAL_SERVER_ERROR
    )
  );
