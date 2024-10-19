import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {MemberCoreInfo} from '../return-types';
import {membersTable} from '../state';

const transformRow = <
  R extends {
    agreementSigned: Date | null | undefined;
  },
>(
  row: R
) => ({
  ...row,
  agreementSigned: O.fromNullable(row.agreementSigned),
});

export const getMemberCore =
  (db: BetterSQLite3Database) =>
  (memberNumber: number): O.Option<MemberCoreInfo> => {
    return pipe(
      db
        .select()
        .from(membersTable)
        .where(eq(membersTable.memberNumber, memberNumber))
        .get(),
      O.fromNullable,
      O.map(transformRow)
    );
  };

export const getAllMemberCore = (
  db: BetterSQLite3Database
): ReadonlyArray<MemberCoreInfo> =>
  pipe(db.select().from(membersTable).all(), RA.map(transformRow));
