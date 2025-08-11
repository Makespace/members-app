import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {inArray, desc} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as RAE from 'fp-ts/ReadonlyNonEmptyArray';
import {MemberCoreInfo} from '../return-types';
import {membersTable} from '../state';
import {MemberCoreInfoPreMerge, mergeMemberCore} from './merge';
import {MemberLinking} from '../member-linking';

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
