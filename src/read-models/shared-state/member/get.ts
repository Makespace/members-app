import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq, or, inArray, desc} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as RAE from 'fp-ts/ReadonlyNonEmptyArray';
import {MemberCoreInfo} from '../return-types';
import {memberLinkTable, membersTable} from '../state';
import {mergeMemberCore} from './merge';
import {NonEmptyArray} from 'fp-ts/lib/NonEmptyArray';
import {accumByMap} from '../../../util';

const transformRow = <
  R extends {
    agreementSigned: Date | null | undefined;
    superUserSince: Date | null | undefined;
  },
>(
  row: R
) => ({
  ...row,
  agreementSigned: O.fromNullable(row.agreementSigned),
  superUserSince: O.fromNullable(row.superUserSince),
});

const getMemberNumbers =
  (db: BetterSQLite3Database) =>
  (memberNumber: number): NonEmptyArray<number> =>
    pipe(
      db
        .select({
          oldMembershipNumber: memberLinkTable.oldMembershipNumber,
          newMembershipNumber: memberLinkTable.newMembershipNumber,
        })
        .from(memberLinkTable)
        .where(
          or(
            eq(memberLinkTable.oldMembershipNumber, memberNumber),
            eq(memberLinkTable.newMembershipNumber, memberNumber)
          )
        )
        .all(),
      rows =>
        Array.from(
          new Set([
            ...rows.flatMap(row => [
              row.oldMembershipNumber,
              row.newMembershipNumber,
            ]),
            memberNumber,
          ])
        ) as NonEmptyArray<number>
    );

export const getMemberCore =
  (db: BetterSQLite3Database) =>
  (memberNumber: number): O.Option<MemberCoreInfo> => {
    const memberDataToGet = getMemberNumbers(db)(memberNumber);
    return pipe(
      db
        .select()
        .from(membersTable)
        .where(inArray(membersTable.memberNumber, memberDataToGet))
        .orderBy(desc(membersTable.memberNumber))
        .all(),
      RA.match(
        () => O.none,
        rows => O.some(mergeMemberCore(RAE.map(transformRow)(rows)))
      )
    );
  };

export const getAllMemberCore = (
  db: BetterSQLite3Database
): ReadonlyArray<MemberCoreInfo> => {
  
}
  // pipe(
  //   db
  //     .select()
  //     .from(membersTable)
  //     .orderBy(desc(membersTable.memberNumber))
  //     .all(),
  //   RA.map(transformRow),
  //   accumByMap(r => r.memberNumber, mergeMemberCore)
  // );
