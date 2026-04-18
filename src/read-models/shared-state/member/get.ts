import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {and, desc, eq, isNotNull} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {MemberCoreInfo, MemberEmail} from '../return-types';
import {memberEmailsTable, memberNumbersTable, membersTable} from '../state';
import {EmailAddress, UserId} from '../../../types';
import {normaliseEmailAddress} from '../normalise-email-address';

const getMemberNumbers =
  (db: BetterSQLite3Database) =>
  (userId: UserId): ReadonlyArray<number> =>
    db
      .select({memberNumber: memberNumbersTable.memberNumber})
      .from(memberNumbersTable)
      .where(eq(memberNumbersTable.userId, userId))
      .orderBy(desc(memberNumbersTable.memberNumber))
      .all()
      .map(row => row.memberNumber);

const getMemberEmails =
  (db: BetterSQLite3Database) =>
  (userId: UserId): ReadonlyArray<MemberEmail> =>
    pipe(
      db
        .select()
        .from(memberEmailsTable)
        .where(eq(memberEmailsTable.userId, userId))
        .orderBy(desc(memberEmailsTable.addedAt))
        .all(),
      RA.reduce([] as MemberEmail[], (emails, email) =>
        emails.some(existing => existing.emailAddress === email.emailAddress)
          ? emails
          : [
              ...emails,
              {
                emailAddress: email.emailAddress,
                addedAt: email.addedAt,
                verifiedAt: O.fromNullable(email.verifiedAt),
                verificationLastSent: O.fromNullable(
                  email.verificationLastSent
                ),
              },
            ]
      )
    );

export const findUserIdByMemberNumber = (
  db: BetterSQLite3Database
) => (
  memberNumber: number
): O.Option<UserId> =>
  pipe(
    db
      .select({
        userId: memberNumbersTable.userId,
      })
      .from(memberNumbersTable)
      .where(eq(memberNumbersTable.memberNumber, memberNumber))
      .get(),
    row => O.fromNullable(row?.userId)
  );

export const findUserIdByEmail =
  (db: BetterSQLite3Database) =>
  (
    email: EmailAddress,
    mustBeVerified: boolean
): O.Option<UserId> =>
  pipe(
    db
      .select({userId: memberEmailsTable.userId})
      .from(memberEmailsTable)
      .where(
        mustBeVerified ? and(
          eq(memberEmailsTable.emailAddress, normaliseEmailAddress(email)),
          isNotNull(memberEmailsTable.verifiedAt)
        ) : eq(memberEmailsTable.emailAddress, normaliseEmailAddress(email))
      )
      .get(),
    row => O.fromNullable(row?.userId)
  );

export const getMemberCoreByUserId =
  (db: BetterSQLite3Database) =>
  (userId: UserId): O.Option<MemberCoreInfo> => {
    const row = db
      .select()
      .from(membersTable)
      .where(eq(membersTable.userId, userId))
      .get();
    const memberNumbers = getMemberNumbers(db)(userId);
    if (!row || memberNumbers.length === 0) {
      return O.none;
    }
    const memberNumber = memberNumbers[0];
    return O.some({
      userId,
      memberNumber,
      pastMemberNumbers: memberNumbers.filter(n => n !== memberNumber),
      primaryEmailAddress: row.primaryEmailAddress,
      emails: getMemberEmails(db)(userId),
      name: row.name,
      formOfAddress: row.formOfAddress,
      agreementSigned: O.fromNullable(row.agreementSigned),
      isSuperUser: row.isSuperUser,
      superUserSince: O.fromNullable(row.superUserSince),
      gravatarHash: row.gravatarHash,
      status: row.status,
      joined: row.joined,
    });
  };

export const getAllMemberCore = (
  db: BetterSQLite3Database
): ReadonlyArray<MemberCoreInfo> =>
  pipe(
    db.select({userId: membersTable.userId}).from(membersTable).all(),
    RA.filterMap(row => getMemberCoreByUserId(db)(row.userId))
  );

export const findAllSuperUsers = (
  db: BetterSQLite3Database
): ReadonlyArray<MemberCoreInfo> =>
  pipe(
    db
      .select({userId: membersTable.userId})
      .from(membersTable)
      .where(eq(membersTable.isSuperUser, true))
      .all(),
    RA.filterMap(row => getMemberCoreByUserId(db)(row.userId))
  );
    
