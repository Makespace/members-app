import * as TE from 'fp-ts/TaskEither';
import {failureWithStatus} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import * as libsqlClient from '@libsql/client';
import {QueryEventsDatabase} from './query-events-database';
import {pipe} from 'fp-ts/lib/function';

export const initQueryEventsDatabase = (): QueryEventsDatabase => {
  const client = libsqlClient.createClient({url: ':memory:'});
  return (query: string, args: libsqlClient.InArgs) =>
    pipe(
      TE.tryCatch(
        () =>
          client.batch([
            {
              sql: query,
              args: args,
            },
          ]),
        failureWithStatus('DB query failed', StatusCodes.INTERNAL_SERVER_ERROR)
      ),
      TE.map(results => results[0])
    );
};
