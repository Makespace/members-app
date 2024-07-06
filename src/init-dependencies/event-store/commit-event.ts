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
import {Client} from '@libsql/client/.';
import {DomainEvent, ResourceVersion} from '../../types';
import {Resource} from '../../types/resource';

export const initialVersionNumber = 0;

const insertEventRow = `
    INSERT INTO events
    (id, resource_id, resource_type, resource_version, event_type, payload)
    SELECT $id, $resource_id, $resource_type, $resource_version, $event_type, $payload
    WHERE NOT EXISTS (
      SELECT * FROM events
      WHERE resource_id = $resource_id
        AND resource_type = $resource_type
        AND resource_version = $resource_version
    );
  `;

const performTransaction = async (
  event: DomainEvent,
  resource: Resource,
  lastKnownVersion: ResourceVersion,
  dbClient: Client
): Promise<'raised-event' | 'last-known-version-out-of-date'> => {
  const newResourceVersion =
    lastKnownVersion === 'no-such-resource'
      ? initialVersionNumber
      : lastKnownVersion + 1;
  const result = await dbClient.execute({
    sql: insertEventRow,
    args: constructArgsForNewEventRow(event, resource, newResourceVersion),
  });
  return result.rowsAffected === 1
    ? 'raised-event'
    : 'last-known-version-out-of-date';
};

export const commitEvent =
  (dbClient: Client, logger: Logger): Dependencies['commitEvent'] =>
  (resource, lastKnownVersion) =>
  (
    event
  ): TE.TaskEither<FailureWithStatus, {status: number; message: string}> => {
    return pipe(
      TE.tryCatch(
        () => performTransaction(event, resource, lastKnownVersion, dbClient),
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
      })
    );
  };

const constructArgsForNewEventRow = (
  event: DomainEvent,
  resource: Resource,
  version: number
) =>
  pipe(event, ({type, ...payload}) => ({
    id: uuidv4(),
    resource_id: resource.id,
    resource_type: resource.type,
    resource_version: version,
    event_type: type,
    payload: JSON.stringify(payload),
  }));
