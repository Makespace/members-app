import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {failureWithStatus} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {QueryEventsDatabase} from './query-events-database';

export const getResourceEvents =
  (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
    queryEventsDatabase: QueryEventsDatabase
  ): Dependencies['getResourceEvents'] =>
  () =>
    TE.left(
      failureWithStatus('not implemented', StatusCodes.INTERNAL_SERVER_ERROR)()
    );
