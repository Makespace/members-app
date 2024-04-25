import mysql from 'mysql';
import * as TE from 'fp-ts/TaskEither';
import {failureWithStatus} from '../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {Config} from '../configuration';
import {QueryMakespaceDatabase} from './query-database';

export const initQueryMemberDatabase = (
  conf: Config
): QueryMakespaceDatabase => {
  const pool = mysql.createPool({
    host: conf.MAKESPACE_DB_HOST,
    database: conf.MEMBERS_DB_NAME,
    password: conf.MEMBERS_DB_PASSWORD,
    user: conf.MEMBERS_DB_USER,
  });

  return (query: string, values?: unknown) =>
    TE.tryCatch(
      () =>
        new Promise((resolve, reject) => {
          pool.query(query, values, (error, elements) => {
            if (error) {
              return reject(error);
            }
            return resolve(elements);
          });
        }),
      failureWithStatus('DB query failed', StatusCodes.INTERNAL_SERVER_ERROR)
    );
};
