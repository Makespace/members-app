import * as TE from 'fp-ts/TaskEither';
import {failureWithStatus} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import * as libsqlClient from '@libsql/client';
import {QueryEventsDatabase} from './query-events-database';

export const initQueryEventsDatabase = (): QueryEventsDatabase => {
  const client = libsqlClient.createClient({url: ':memory:'});
  return (query: string, args: libsqlClient.InArgs) =>
    TE.tryCatch(
      () =>
        client.execute({
          sql: query,
          args: args,
        }),

      failureWithStatus('DB query failed', StatusCodes.INTERNAL_SERVER_ERROR)
    );
};
