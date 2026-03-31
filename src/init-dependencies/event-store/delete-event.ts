import {Client} from '@libsql/client';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../../dependencies';
import {Actor} from '../../types/actor';
import {failureWithStatus} from '../../types/failure-with-status';
import {dbExecute} from '../../util';

const insertDeletedEvent = async (
  dbClient: Client,
  eventId: string,
  deletedBy: Actor,
  reason: string
) => {
  const result = await dbExecute(
    dbClient,
    `
      INSERT INTO deleted_events (event_id, deleted_at, deleted_by, reason)
      SELECT ?, ?, ?, ?
      WHERE EXISTS (
        SELECT * FROM events
        WHERE id = ?
      )
      AND NOT EXISTS (
        SELECT * FROM deleted_events
        WHERE event_id = ?
      );
    `,
    [
      eventId,
      new Date().toISOString(),
      JSON.stringify(deletedBy),
      reason,
      eventId,
      eventId,
    ]
  );

  if (result.rowsAffected === 1) {
    return 'deleted' as const;
  }

  const existingDeletedEvent = await dbExecute(
    dbClient,
    'SELECT event_id FROM deleted_events WHERE event_id = ?;',
    [eventId]
  );

  return existingDeletedEvent.rows.length > 0
    ? ('already-deleted' as const)
    : ('not-found' as const);
};

export const deleteEvent =
  (dbClient: Client): Dependencies['deleteEvent'] =>
  (eventId, deletedBy, reason) =>
    pipe(
      TE.tryCatch(
        () => insertDeletedEvent(dbClient, eventId, deletedBy, reason),
        failureWithStatus(
          'Failed to delete event',
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      ),
      TE.chainEitherK(result => {
        switch (result) {
          case 'deleted':
            return E.right({
              status: StatusCodes.CREATED as StatusCodes.CREATED,
              message: 'Deleted event',
            });
          case 'already-deleted':
            return E.right({
              status: StatusCodes.CREATED as StatusCodes.CREATED,
              message: 'Event already deleted',
            });
          case 'not-found':
            return E.left(
              failureWithStatus('Event does not exist', StatusCodes.NOT_FOUND)()
            );
        }
      })
    );
