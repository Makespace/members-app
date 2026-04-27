import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../../dependencies';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {dbExecute} from '../../util';
import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';

const ensureEventExists = (dbClient: Client, eventIndex: number) =>
  pipe(
    TE.tryCatch(
      () =>
        dbExecute(
          dbClient,
          'SELECT event_index FROM events WHERE event_index = ?;',
          [eventIndex]
        ),
      failureWithStatus(
        'Failed to check whether event exists',
        StatusCodes.INTERNAL_SERVER_ERROR
      )
    ),
    TE.chainEitherK(result =>
      result.rows.length > 0
        ? E.right(undefined)
        : E.left(
            failureWithStatus(
              `Could not find event ${eventIndex}`,
              StatusCodes.NOT_FOUND
            )()
          )
    )
  );

export const setEventDeletedState =
  (dbClient: Client): Dependencies['setEventDeletedState'] =>
  (eventIndex, deleted) =>
    pipe(
      ensureEventExists(dbClient, eventIndex),
      TE.chain(() =>
        TE.tryCatch(
          () =>
            deleted
              ? dbExecute(
                  dbClient,
                  `
                  INSERT OR REPLACE INTO deleted_events (event_index, deleted_at)
                  VALUES (?, ?);
                  `,
                  [eventIndex, new Date().toISOString()]
                )
              : dbExecute(
                  dbClient,
                  'DELETE FROM deleted_events WHERE event_index = ?;',
                  [eventIndex]
                ),
          failureWithStatus(
            'Failed to update deleted state for event',
            StatusCodes.INTERNAL_SERVER_ERROR
          )
        )
      ),
      TE.map(() => undefined)
    );
