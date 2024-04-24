import * as TE from 'fp-ts/TaskEither';
import {EmailAddress, failure, Failure} from '../types';
import {flow, pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import * as tt from 'io-ts-types';
import {QueryDatabase} from './query-database';

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

const MemberNumberQueryResult = tt.readonlyNonEmptyArray(
  t.type({
    Member_Number: t.Int,
  })
);

type GetMemberNumber = (
  emailAddress: EmailAddress
) => TE.TaskEither<Failure, number>;

export const getMemberNumber =
  (queryDatabase: QueryDatabase): GetMemberNumber =>
  email =>
    pipe(
      queryDatabase(selectMemberNumberWhereEmail, [email, email]),
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
      TE.map(([result]) => result.Member_Number)
    );
