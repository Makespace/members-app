import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq, or, inArray, desc} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as RAE from 'fp-ts/ReadonlyNonEmptyArray';
import {MemberCoreInfo} from '../return-types';
import {memberLinkTable, membersTable} from '../state';
import {MemberCoreInfoPreMerge, mergeMemberCore} from './merge';
import {NonEmptyArray} from 'fp-ts/lib/NonEmptyArray';
import {groupMembershipNumbers} from './group-membership-numbers';
import {ReadonlyNonEmptyArray} from 'fp-ts/ReadonlyNonEmptyArray';

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
          oldMemberNumber: memberLinkTable.oldMemberNumber,
          newMemberNumber: memberLinkTable.newMemberNumber,
        })
        .from(memberLinkTable)
        .where(
          or(
            eq(memberLinkTable.oldMemberNumber, memberNumber),
            eq(memberLinkTable.newMemberNumber, memberNumber)
          )
        )
        .all(),
      rows =>
        Array.from(
          new Set([
            ...rows.flatMap(row => [row.oldMemberNumber, row.newMemberNumber]),
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

const getMemberNumberGrouping = (
  db: BetterSQLite3Database
): ReadonlyArray<ReadonlyNonEmptyArray<number>> =>
  groupMembershipNumbers(
    db
      .select({
        a: memberLinkTable.oldMemberNumber,
        b: memberLinkTable.newMemberNumber,
      })
      .from(memberLinkTable)
      .all()
  );

const nonEmptyMapFilter = <T, R>(
  i: ReadonlyNonEmptyArray<T>,
  fn: (t: T) => R
): ReadonlyNonEmptyArray<R> => i.map(fn).filter(e => e) as NonEmptyArray<R>;

export const getAllMemberCore = (
  db: BetterSQLite3Database
): ReadonlyArray<MemberCoreInfo> => {
  // I feel like there might be a better way than this.
  // Perhaps the shared read model sql lite database isn't the way to store the member number grouping.
  const membersLookup: Record<number, MemberCoreInfoPreMerge> = {};
  for (const row of db.select().from(membersTable).all()) {
    membersLookup[row.memberNumber] = transformRow(row);
  }
  const result: MemberCoreInfo[] = [];
  for (const grouping of getMemberNumberGrouping(db)) {
    result.push(
      mergeMemberCore(
        nonEmptyMapFilter(grouping, memberNumber => membersLookup[memberNumber])
      )
    );
    for (const groupingMemberNumber of grouping) {
      delete membersLookup[groupingMemberNumber];
    }
  }
  for (const remaining of Object.values(membersLookup)) {
    result.push(mergeMemberCore([remaining]));
  }
  return result;
};
