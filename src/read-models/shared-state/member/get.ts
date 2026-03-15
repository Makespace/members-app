import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {and, desc, eq, inArray, isNotNull} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as RAE from 'fp-ts/ReadonlyNonEmptyArray';
import {MemberCoreInfo, MemberEmail} from '../return-types';
import {memberEmailsTable, membersTable} from '../state';
import {MemberCoreInfoPreMerge, mergeMemberCore} from './merge';
import {MemberLinking} from '../member-linking';
import {EmailAddress} from '../../../types';
import {normaliseEmailAddress} from '../normalise-email-address';

const getMemberEmails =
  (db: BetterSQLite3Database) =>
  (memberNumbers: number[]): Map<number, ReadonlyArray<MemberEmail>> => {
    const emails = db
      .select()
      .from(memberEmailsTable)
      .where(inArray(memberEmailsTable.memberNumber, memberNumbers))
      .orderBy(desc(memberEmailsTable.addedAt))
      .all();
    const byMemberNumber = new Map<number, Array<MemberEmail>>();
    emails.forEach(email => {
      byMemberNumber.set(email.memberNumber, [
        ...(byMemberNumber.get(email.memberNumber) ?? []),
        {
          emailAddress: email.emailAddress,
          addedAt: email.addedAt,
          verifiedAt: O.fromNullable(email.verifiedAt),
        },
      ]);
    });
    return byMemberNumber;
  };

const getMergedMember =
  (db: BetterSQLite3Database) =>
  (memberNumbers: number[]): O.Option<MemberCoreInfo> =>
    pipe(
      {
        rows: db
          .select()
          .from(membersTable)
          .where(inArray(membersTable.memberNumber, memberNumbers))
          .orderBy(desc(membersTable.memberNumber))
          .all(),
        emailsByMemberNumber: getMemberEmails(db)(memberNumbers),
      },
      ({rows, emailsByMemberNumber}) =>
        pipe(
          rows,
          RA.match(
            () => O.none,
            memberRows =>
              pipe(
                memberRows,
                RAE.map(
                  (row): MemberCoreInfoPreMerge => ({
                    ...row,
                    agreementSigned: O.fromNullable(row.agreementSigned),
                    superUserSince: O.fromNullable(row.superUserSince),
                    emails: emailsByMemberNumber.get(row.memberNumber) ?? [],
                  })
                ),
                records => mergeMemberCore(records, memberNumbers),
                O.some
              )
          )
        )
    );

export const getMergedMemberSet =
  (db: BetterSQLite3Database) =>
  (memberNumbers: ReadonlySet<number>): O.Option<MemberCoreInfo> =>
    getMergedMember(db)(Array.from(memberNumbers.values()));

export const getMemberCore =
  (db: BetterSQLite3Database, linking: MemberLinking) =>
  (memberNumber: number): O.Option<MemberCoreInfo> =>
    getMergedMember(db)(Array.from(linking.map(memberNumber).values()));

export const getAllMemberCore = (
  db: BetterSQLite3Database,
  linking: MemberLinking
): ReadonlyArray<MemberCoreInfo> =>
  pipe(linking.all(), RA.filterMap(getMergedMemberSet(db)));

export const findByEmail = (
  db: BetterSQLite3Database,
  linking: MemberLinking
) => (email: EmailAddress): ReadonlyArray<MemberCoreInfo> => {
  // This is a bit grim because member numbers were initially assumed to be uniquely
  // identify a single member but actually a member can have multiple member numbers.
  // This means we need to find all the member numbers then group them then
  // finally use those to actually grab the merged members.
  // A potential solution would be to introduce a proper primary key that represents a single user
  // and then have member numbers map to the primary key 1:M.
  const foundMemberNumbers = db.select({
      memberNumber: memberEmailsTable.memberNumber,
    })
    .from(memberEmailsTable)
    .where(
      and(
        eq(memberEmailsTable.emailAddress, normaliseEmailAddress(email)),
        isNotNull(memberEmailsTable.verifiedAt)
      )
    )
    .orderBy(desc(memberEmailsTable.memberNumber))
    .all()
    .map(row => row.memberNumber);
  const groupedMemberNumbers = linking.mapAll(foundMemberNumbers);
  return groupedMemberNumbers.map(
    getMergedMemberSet(db)
  ).flatMap(
    m => O.isSome(m) ? [m.value] : []
  );
}
