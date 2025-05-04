import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {inArray, desc} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as RAE from 'fp-ts/ReadonlyNonEmptyArray';
import {MemberCoreInfo} from '../return-types';
import {membersTable} from '../state';
import {MemberCoreInfoPreMerge, mergeMemberCore} from './merge';
import {
  getMemberNumberGrouping,
  getMemberNumbers,
} from './group-membership-numbers';
import {nonEmptyMapFilter} from '../../../util';

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

export const getMergedMember =
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
        rows => O.some(mergeMemberCore(RAE.map(transformRow)(rows)))
      )
    );

export const getMemberCore =
  (db: BetterSQLite3Database) =>
  (memberNumber: number): O.Option<MemberCoreInfo> =>
    getMergedMember(db)(getMemberNumbers(db)(memberNumber));

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
