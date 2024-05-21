/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {StatusCodes} from 'http-status-codes';
import {FailureWithStatus} from '../../types/failureWithStatus';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {v4 as uuidv4} from 'uuid';
import {QueryEventsDatabase} from './query-events-database';

export const commitEvent =
  (queryDatabase: QueryEventsDatabase): Dependencies['commitEvent'] =>
  (resource, lastKnownVersion) =>
  (
    event
  ): TE.TaskEither<
    FailureWithStatus,
    {status: StatusCodes.CREATED; message: string}
  > =>
    pipe(
      event,
      ({type, ...payload}) => ({
        id: uuidv4(),
        resource_id: resource.id,
        resource_type: resource.type,
        event_type: type,
        payload: JSON.stringify(payload),
      }),
      row =>
        queryDatabase(
          'INSERT INTO events (id, resource_id, resource_type, event_type, payload) VALUES ($id, $resource_id, $resource_type, $event_type, $payload); ',
          row
        ),
      TE.map(() => ({
        status: StatusCodes.CREATED,
        message: 'Persisted a new event',
      }))
    );
