import {Client} from '@libsql/client';
import {StatusCodes} from 'http-status-codes';
import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import {
  failureWithStatus,
  internalCodecFailure,
} from '../../types/failure-with-status';
import {DeletedEventsTable} from './deleted-events-table';
import {dbExecute} from '../../util';

const insertDeletionSql = `
  INSERT INTO deleted_events (
    event_id,
    deleted_at,
    deleted_by_member_number,
    deletion_reason
  ) VALUES (?, ?, ?, ?);
`;

const getDeletionForEventSql = `
  SELECT
    event_id,
    deleted_at,
    deleted_by_member_number,
    deletion_reason
  FROM deleted_events
  WHERE event_id = ?;
`;

const getEventExistsSql = `
  SELECT id
  FROM events
  WHERE id = ?
  LIMIT 1;
`;

const deleteFailure = (
  message: string,
  status: StatusCodes.NOT_FOUND | StatusCodes.BAD_REQUEST
) =>
  failureWithStatus(message, status)();

export const deleteStoredEvent =
  (
    eventDB: Client,
    logger: Logger,
    refreshReadModel: Dependencies['sharedReadModel']['asyncRefresh']
  ): Dependencies['deleteStoredEvent'] =>
  (eventId, deletedByMemberNumber, reason) =>
    pipe(
      TE.tryCatch(
        async () => {
          const existingEvent = await dbExecute(eventDB, getEventExistsSql, [
            eventId,
          ]);
          const existingDeletion = await dbExecute(
            eventDB,
            getDeletionForEventSql,
            [eventId]
          );
          return {existingEvent, existingDeletion};
        },
        failureWithStatus(
          'Failed to inspect event deletion state',
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      ),
      TE.chainEitherK(({existingEvent, existingDeletion}) => {
        if (existingEvent.rows.length === 0) {
          return E.left(
            deleteFailure('No stored event exists with that id', StatusCodes.NOT_FOUND)
          );
        }

        return pipe(
          DeletedEventsTable.decode(existingDeletion),
          E.mapLeft(
            internalCodecFailure('Failed to decode existing event deletions')
          ),
          E.chain(table =>
            table.rows.length === 0
              ? E.right(undefined)
              : E.left(
                  deleteFailure(
                    'That event has already been deleted',
                    StatusCodes.BAD_REQUEST
                  )
                )
          )
        );
      }),
      TE.chain(() =>
        TE.tryCatch(
          () =>
            dbExecute(eventDB, insertDeletionSql, [
              eventId,
              new Date().toISOString(),
              deletedByMemberNumber,
              reason,
            ]),
          failureWithStatus(
            'Failed to delete stored event',
            StatusCodes.INTERNAL_SERVER_ERROR
          )
        )
      ),
      TE.map(() => {
        logger.info(
          {eventId, deletedByMemberNumber, reason},
          'Stored event deleted'
        );
        return {
          status: StatusCodes.OK as const,
          message: 'Deleted stored event',
        };
      }),
      TE.tapTask(() => refreshReadModel())
    );
