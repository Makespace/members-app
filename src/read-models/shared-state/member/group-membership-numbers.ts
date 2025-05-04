import {or, eq} from 'drizzle-orm';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {pipe} from 'fp-ts/lib/function';
import {NonEmptyArray} from 'fp-ts/lib/NonEmptyArray';
import {ReadonlyNonEmptyArray} from 'fp-ts/lib/ReadonlyNonEmptyArray';
import {memberLinkTable, membersTable} from '../state';

export const getMemberNumberGrouping = (
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

export const getMemberNumbers =
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

export const getAllMemberNumbers = (
  db: BetterSQLite3Database
): ReadonlyNonEmptyArray<number>[] => {
  // I feel like there might be a better way than this.
  // Perhaps the shared read model sql lite database isn't the way to store the member number grouping.
  const membersNumbers = new Set<number>();
  for (const row of db
    .select({memberNumber: membersTable.memberNumber})
    .from(membersTable)
    .all()) {
    membersNumbers.add(row.memberNumber);
  }
  const result: ReadonlyNonEmptyArray<number>[] = [];
  for (const grouping of getMemberNumberGrouping(db)) {
    result.push(grouping);
    for (const groupingMemberNumber of grouping) {
      membersNumbers.delete(groupingMemberNumber);
    }
  }
  for (const remaining of Object.values(membersNumbers)) {
    result.push([remaining]);
  }
  return result;
};

export const findMemberNumberGroups =
  (db: BetterSQLite3Database) =>
  (ungrouped: number[]): NonEmptyArray<number>[] => {
    // For the given member numbers find the groupings.
    const groupings = getMemberNumberGrouping(db);
    for (const memberNumber of ungrouped) {
      // Optimisation possible by making groupings a reverse dictionary lookup.
      if (groupings)
    }
  };
