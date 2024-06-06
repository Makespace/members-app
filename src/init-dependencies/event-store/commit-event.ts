import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import * as RA from 'fp-ts/ReadonlyArray';
import {StatusCodes} from 'http-status-codes';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failureWithStatus';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {v4 as uuidv4} from 'uuid';
import {Client} from '@libsql/client/.';
import {DomainEvent} from '../../types';
import {Resource} from '../../types/resource';

const performTransaction = async (
  event: DomainEvent,
  resource: Resource,
  lastKnownVersion: number,
  dbClient: Client
): Promise<'raised-event' | 'last-known-version-out-of-date'> => {
  const transaction = await dbClient.transaction();
  try {
    const resourceVersions = await transaction.execute({
      sql: `
        SELECT resource_version
        FROM events
        WHERE resource_id =?
        AND resource_type =?
        `,
      args: [resource.id, resource.type],
    });
    const currentResourceVersion = Math.max(
      ...pipe(
        resourceVersions.rows,
        RA.map(row => row['resource_version'] as number)
      )
    );
    let newResourceVersion: number;

    if (resourceVersions.rows.length === 0) {
      newResourceVersion = lastKnownVersion;
    } else {
      if (currentResourceVersion === lastKnownVersion) {
        newResourceVersion = lastKnownVersion + 1;
      } else {
        return 'last-known-version-out-of-date';
      }
    }
    const args = pipe(event, ({type, ...payload}) => ({
      id: uuidv4(),
      resource_id: resource.id,
      resource_type: resource.type,
      resource_version: newResourceVersion,
      event_type: type,
      payload: JSON.stringify(payload),
    }));
    await transaction.execute({
      sql: 'INSERT INTO events (id, resource_id, resource_type, resource_version, event_type, payload) VALUES ($id, $resource_id, $resource_type, $resource_version, $event_type, $payload); ',
      args,
    });
    await transaction.commit();
    return 'raised-event';
  } finally {
    transaction.close();
  }
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
