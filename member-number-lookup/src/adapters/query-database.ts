import mysql from 'mysql';
import * as TE from 'fp-ts/TaskEither';
import {FailureWithStatus, failureWithStatus} from '../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {Config} from '../configuration';

export type QueryDatabase = (
  query: string,
  values?: unknown
) => TE.TaskEither<FailureWithStatus, unknown>;

export const initQueryDatabase = (conf: Config): QueryDatabase => {
  const pool = mysql.createPool({
    host: conf.MYSQL_HOST,
    database: conf.MYSQL_DATABASE,
    user: conf.MYSQL_USER,
    password: conf.MYSQL_PASSWORD,
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
