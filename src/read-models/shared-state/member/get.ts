import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {inArray, desc, eq} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as RAE from 'fp-ts/ReadonlyNonEmptyArray';
import {MemberCoreInfo} from '../return-types';
import {membersTable} from '../state';
import {MemberCoreInfoPreMerge, mergeMemberCore} from './merge';
import {MemberLinking} from '../member-linking';
import { EmailAddress } from '../../../types';
import { normaliseEmailAddress } from '../normalise-email-address';

const getMergedMember =
  (db: BetterSQLite3Database) =>
  (memberNumbers: number[]): O.Option<MemberCoreInfo> =>
    pipe(
      db
        .select()
        .from(membersTable)
        .where(inArray(membersTable.memberNumber, memberNumbers))
        .orderBy(desc(membersTable.memberNumber))
        .all(),
      RA.match(
        () => O.none,
        rows =>
          pipe(
            rows,
            RAE.map(
              (row): MemberCoreInfoPreMerge => ({
                ...row,
                agreementSigned: O.fromNullable(row.agreementSigned),
                superUserSince: O.fromNullable(row.superUserSince),
              })
            ),
            records => mergeMemberCore(records, memberNumbers),
            O.some
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
      memberNumber: membersTable.memberNumber,
    })
    .from(membersTable)
    .where(eq(membersTable.emailAddress, normaliseEmailAddress(email)))
    .orderBy(desc(membersTable.memberNumber))
    .all()
    .map(row => row.memberNumber);
  const groupedMemberNumbers = linking.mapAll(foundMemberNumbers);
  return groupedMemberNumbers.map(
    getMergedMemberSet(db)
  ).flatMap(
    m => O.isSome(m) ? [m.value] : []
  );
}
