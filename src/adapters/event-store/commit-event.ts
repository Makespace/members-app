import {StatusCodes} from 'http-status-codes';
import {FailureWithStatus} from '../../types/failureWithStatus';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {DomainEvent} from '../../types';
import {v4 as uuidv4} from 'uuid';
import {QueryEventsDatabase} from './query-events-database';

export const commitEvent =
  (queryDatabase: QueryEventsDatabase): Dependencies['commitEvent'] =>
  (
    event: DomainEvent
  ): TE.TaskEither<
    FailureWithStatus,
    {status: StatusCodes.CREATED; message: string}
  > =>
    pipe(
      event,
      ({type, ...payload}) => ({
        id: uuidv4(),
        resource_id: '2d6f5d4b-5f90-4894-867a-73c27d0e408e',
        resource_type: 'CatchAll',
        event_type: type,
        payload: JSON.stringify(payload),
      }),
      row => queryDatabase('INSERT INTO events set ?; ', row),
      TE.map(() => ({
        status: StatusCodes.CREATED,
        message: 'Persisted a new event',
      }))
    );
