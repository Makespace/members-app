import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import {StatusCodes} from 'http-status-codes';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {v4 as uuidv4} from 'uuid';
import {Client} from '@libsql/client';
import {DomainEvent, ResourceVersion} from '../../types';
import {Resource} from '../../types/resource';
import {dbExecute} from '../../util';

export const initialVersionNumber = 0;

const constructArgsForNewEventRow = (
  event: DomainEvent,
  resource: Resource,
  version: number
) =>
  pipe(event, ({type, ...payload}) => [
    uuidv4(),
    resource.id,
    resource.type,
    version,
    type,
    JSON.stringify(payload),
    resource.id,
    resource.type,
    version,
  ]);

const insertEventRow = `
    INSERT INTO events
    (id, resource_id, resource_type, resource_version, event_type, payload)
    SELECT ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT * FROM events
      WHERE resource_id = ?
        AND resource_type = ?
        AND resource_version = ?
    );
  `;

const insertEventWithOptimisticConcurrencyControl = async (
  event: DomainEvent,
  resource: Resource,
  lastKnownVersion: ResourceVersion,
  eventDB: Client,
  logger: Logger
): Promise<'raised-event' | 'last-known-version-out-of-date'> => {
  const newResourceVersion =
    lastKnownVersion === 'no-such-resource'
      ? initialVersionNumber
      : lastKnownVersion + 1;
  const result = await dbExecute(
    eventDB,
    insertEventRow,
    constructArgsForNewEventRow(event, resource, newResourceVersion)
  );
  logger.debug({rowsAffected: result.rowsAffected}, 'OCC feedback is broken');
  return 'raised-event';
};

export const commitEvent =
  (
    eventDB: Client,
    logger: Logger,
    refreshReadModel: Dependencies['sharedReadModel']['asyncRefresh']
  ): Dependencies['commitEvent'] =>
  (resource, lastKnownVersion) =>
  (
    event
  ): TE.TaskEither<FailureWithStatus, {status: number; message: string}> => {
    return pipe(
      TE.tryCatch(
        () =>
          insertEventWithOptimisticConcurrencyControl(
            event,
            resource,
            lastKnownVersion,
            eventDB,
            logger
          ),
        failureWithStatus(
          'Failed to commit event',
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      ),
      TE.chainEitherK(result => {
        switch (result) {
          case 'raised-event':
            logger.info(event, 'Event committed');
            return E.right({
              message: 'Raised event',
              status: StatusCodes.CREATED,
            });
          case 'last-known-version-out-of-date':
            return E.left(
              failureWithStatus(
                'Resource has changes since the event to be committed was computed',
                StatusCodes.BAD_REQUEST
              )()
            );
        }
      }),
      TE.tapTask(() => refreshReadModel())
    );
  };
