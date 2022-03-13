import * as TE from 'fp-ts/TaskEither';
import {Email} from '../types';
import mysql from 'mysql';
import {identity, pipe} from 'fp-ts/lib/function';

type GetMemberNumber = (email: Email) => TE.TaskEither<string, number>;

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
});

export const getMemberNumber = (): GetMemberNumber => {
  return () =>
    pipe(
      TE.tryCatch(
        () =>
          new Promise((resolve, reject) => {
            pool.query(
              'SELECT Given_Member_Number FROM InductionFormResponse',
              (error, elements) => {
                if (error) {
                  return reject(error);
                }
                return resolve(elements);
              }
            );
          }),
        identity
      ),
      TE.bimap(String, () => 42)
    );
};
