import * as TE from 'fp-ts/TaskEither';
import {failureWithStatus} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {InArgs, createClient} from '@libsql/client/.';
import {QueryEventsDatabase} from './query-events-database';

// ts-unused-exports:disable-next-line
export const initQueryEventsDatabase = (): QueryEventsDatabase => {
  const client = createClient({url: ':memory:'});
  return (query: string, args: InArgs) =>
    TE.tryCatch(
      () =>
        client.execute({
          sql: query,
          args: args,
        }),

      failureWithStatus('DB query failed', StatusCodes.INTERNAL_SERVER_ERROR)
    );
};
