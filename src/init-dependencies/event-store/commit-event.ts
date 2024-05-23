/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {StatusCodes} from 'http-status-codes';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failureWithStatus';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {v4 as uuidv4} from 'uuid';
import {Client, InArgs} from '@libsql/client/.';

const performTransaction = (dbClient: Client, args: InArgs) => {
  return dbClient.execute({
    sql: 'INSERT INTO events (id, resource_id, resource_type, resource_version, event_type, payload) VALUES ($id, $resource_id, $resource_type, $resource_version, $event_type, $payload); ',
    args,
  });
};

export const commitEvent =
  (dbClient: Client): Dependencies['commitEvent'] =>
  (resource, lastKnownVersion) =>
  (
    event
  ): TE.TaskEither<
    FailureWithStatus,
    {status: StatusCodes.CREATED; message: string}
  > => {
    const args = pipe(event, ({type, ...payload}) => ({
      id: uuidv4(),
      resource_id: resource.id,
      resource_type: resource.type,
      resource_version: lastKnownVersion + 1,
      event_type: type,
      payload: JSON.stringify(payload),
    }));
    return pipe(
      TE.tryCatch(
        () => performTransaction(dbClient, args),
        failureWithStatus('DB query failed', StatusCodes.INTERNAL_SERVER_ERROR)
      ),
      TE.map(() => ({
        status: StatusCodes.CREATED,
        message: 'Persisted a new event',
      }))
    );
  };
