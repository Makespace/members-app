import * as TE from 'fp-ts/TaskEither';
import {EmailAddress} from '../types';
import mysql from 'mysql';
import {flow, pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import * as tt from 'io-ts-types';

type GetMemberNumber = (
  emailAddress: EmailAddress
) => TE.TaskEither<string, number>;

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
});

const MemberNumberResponse = tt.readonlyNonEmptyArray(
  t.type({
    Given_Member_Number: t.Int,
  })
);

export const getMemberNumber = (): GetMemberNumber => email =>
  pipe(
    TE.tryCatch(
      () =>
        new Promise((resolve, reject) => {
          pool.query(
            'SELECT Given_Member_Number FROM InductionFormResponse WHERE Member_Email = ?',
            [email],
            (error, elements) => {
              if (error) {
                return reject(error);
              }
              return resolve(elements);
            }
          );
        }),
      String
    ),
    TE.chainEitherK(
      flow(
        MemberNumberResponse.decode,
        E.mapLeft(formatValidationErrors),
        E.mapLeft(errors => errors.join('\n'))
      )
    ),
    TE.filterOrElse(
      memberNumbers => memberNumbers.length === 1,
      memberNumbers =>
        `${email} is associated with more than one member number: ${memberNumbers.map(
          i => i.Given_Member_Number
        )}`
    ),
    TE.map(([result]) => result.Given_Member_Number)
  );
