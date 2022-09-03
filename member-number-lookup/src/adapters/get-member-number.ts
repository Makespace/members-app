import * as TE from 'fp-ts/TaskEither';
import {EmailAddress, failure, Failure} from '../types';
import mysql, {Pool} from 'mysql';
import {flow, pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import * as tt from 'io-ts-types';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
});

const selectMemberNumberWhereEmail = `
SELECT Member_Number
FROM RecurlyAccounts
JOIN MemberRecurlyAccount
JOIN Members
ON MemberRecurlyAccount.Member = Members.idMembers
AND RecurlyAccounts.idRecurlyAccounts = MemberRecurlyAccount.RecurlyAccount
WHERE
Email = ? OR Account_Code = ?
;`;

const queryDatabase = (pool: Pool, query: string, values?: unknown) => {
  return new Promise((resolve, reject) => {
    pool.query(query, values, (error, elements) => {
      if (error) {
        return reject(error);
      }
      return resolve(elements);
    });
  });
};

const MemberNumberQueryResult = tt.readonlyNonEmptyArray(
  t.type({
    Member_Number: t.Int,
  })
);

type GetMemberNumber = (
  emailAddress: EmailAddress
) => TE.TaskEither<Failure, number>;

export const getMemberNumber = (): GetMemberNumber => email =>
  pipe(
    TE.tryCatch(
      () => queryDatabase(pool, selectMemberNumberWhereEmail, [email, email]),
      failure('DB query failed')
    ),
    TE.chainEitherK(
      flow(
        MemberNumberQueryResult.decode,
        E.mapLeft(formatValidationErrors),
        E.mapLeft(failure('Failed to decode MemberNumber from DB result'))
      )
    ),
    TE.filterOrElse(
      memberNumbers => memberNumbers.length === 1,
      memberNumbers =>
        failure('No unique match of MemberNumber to EmailAddress')({
          memberNumbers,
          email,
        })
    ),
    TE.map(([result]) => result.Given_Member_Number)
  );
