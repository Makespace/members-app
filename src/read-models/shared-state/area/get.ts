import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq, sql} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {
  areaNameAliasesTable,
  areasTable,
  memberNumbersTable,
  membersTable,
  ownersTable,
} from '../state';
import {UUID} from 'io-ts-types';
import {Actor, EmailAddress, UserId} from '../../../types';
import {MinimalArea} from '../return-types';

const transformRow = <
  R extends {
    id: string;
    name: string;
    email: string | null;
  },
>(
  row: R
): MinimalArea => ({
  id: row.id as UUID,
  name: row.name,
  email: O.fromNullable(row.email as EmailAddress | null),
});

export const getAreaMinimal =
  (db: BetterSQLite3Database) =>
  (id: UUID): O.Option<MinimalArea> =>
    pipe(
      db.select().from(areasTable).where(eq(areasTable.id, id)).get(),
      O.fromNullable,
      O.map(transformRow)
    );

export const getAllAreaMinimal = (
  db: BetterSQLite3Database
): ReadonlyArray<MinimalArea> =>
  pipe(db.select().from(areasTable).all(), RA.map(transformRow));

export type AreaOwnerRow = {
  areaId: UUID;
  userId: UserId;
  memberNumber: number;
  pastMemberNumbers: ReadonlyArray<number>;
  name: O.Option<string>;
  primaryEmailAddress: EmailAddress;
  agreementSigned: O.Option<Date>;
  ownershipRecordedAt: Date;
  markedOwnerBy: O.Option<Actor>;
};

// One query per table for every area's owners at once, in the same shape the
// full per-area expansion produces for each owner. The /areas page needs only
// these fields; loading them in bulk avoids the per-owner member/number/email
// lookups that otherwise scale with total owners (issue #414).
export const getAllOwnersBulk = (
  db: BetterSQLite3Database
): ReadonlyArray<AreaOwnerRow> =>
  pipe(
    db
      .select({
        areaId: ownersTable.areaId,
        userId: membersTable.userId,
        name: membersTable.name,
        primaryEmailAddress: membersTable.primaryEmailAddress,
        agreementSigned: membersTable.agreementSigned,
        ownershipRecordedAt: ownersTable.ownershipRecordedAt,
        markedOwnerByActor: ownersTable.markedOwnerByActor,
        memberNumber: memberNumbersTable.memberNumber,
      })
      .from(ownersTable)
      .innerJoin(membersTable, eq(membersTable.userId, ownersTable.userId))
      .innerJoin(
        memberNumbersTable,
        eq(memberNumbersTable.userId, ownersTable.userId)
      )
      .all(),
      // One owner per (area, user): the highest member number is the current
      // one and the rest are past numbers, matching member/get's rule.
      rows => {
        type PartialRow = {
          row: (typeof rows)[number];
          numbers: number[];
        };
        const grouped = new Map<string, PartialRow>();
        for (const row of rows) {
          const key = `${row.areaId}|${row.userId}`;
          const entry = grouped.get(key);
          if (entry === undefined) {
            grouped.set(key, {row, numbers: [row.memberNumber]});
          } else {
            entry.numbers.push(row.memberNumber);
          }
        }
        return [...grouped.values()].map(({row, numbers}) => {
          const sorted = [...numbers].sort((a, b) => b - a);
          return {
            areaId: row.areaId as UUID,
            userId: row.userId,
            memberNumber: sorted[0],
            pastMemberNumbers: sorted.slice(1),
            name: row.name,
            primaryEmailAddress: row.primaryEmailAddress,
            agreementSigned: O.fromNullable(row.agreementSigned),
            ownershipRecordedAt: row.ownershipRecordedAt,
            markedOwnerBy: O.fromEither(Actor.decode(row.markedOwnerByActor)),
          };
        });
      }
  );

// Resolves a freeform label to an area - by the area's own name first, then
// registered area aliases. Case- and whitespace-insensitive.
export const resolveAreaByName =
  (db: BetterSQLite3Database) =>
  (name: string): O.Option<UUID> => {
    const needle = name.trim().toLowerCase();
    const byName = db
      .select({id: areasTable.id})
      .from(areasTable)
      .where(sql`lower(trim(${areasTable.name})) = ${needle}`)
      .get();
    if (byName !== undefined) {
      return O.some(byName.id as UUID);
    }
    return pipe(
      db
        .select({id: areaNameAliasesTable.areaId})
        .from(areaNameAliasesTable)
        .where(sql`lower(trim(${areaNameAliasesTable.alias})) = ${needle}`)
        .get(),
      O.fromNullable,
      O.map(row => row.id)
    );
  };
