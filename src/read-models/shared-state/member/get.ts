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

export const findUserId = (
  db: BetterSQLite3Database,
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
    row => O.fromNullable(row?.userId as UserId | undefined)
  );

export const getMemberByUserId =
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

export const getMemberCore =
  (db: BetterSQLite3Database) =>
  (memberNumber: number): O.Option<MemberCoreInfo> =>
    pipe(findUserId(db, memberNumber), O.chain(getMemberByUserId(db)));

export const getAllMemberCore = (
  db: BetterSQLite3Database
): ReadonlyArray<MemberCoreInfo> =>
  pipe(
    db.select({userId: membersTable.userId}).from(membersTable).all(),
    RA.filterMap(row => getMemberByUserId(db)(row.userId as UserId))
  );

export const findByEmail =
  (db: BetterSQLite3Database) =>
  (email: EmailAddress): ReadonlyArray<MemberCoreInfo> =>
    pipe(
      db
        .select({userId: memberEmailsTable.userId})
        .from(memberEmailsTable)
        .where(
          and(
            eq(memberEmailsTable.emailAddress, normaliseEmailAddress(email)),
            isNotNull(memberEmailsTable.verifiedAt)
          )
        )
        .all(),
      rows => Array.from(new Set(rows.map(row => row.userId as UserId))),
      RA.filterMap(getMemberByUserId(db))
    );
