import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq, sql} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {areaNameAliasesTable, areasTable} from '../state';
import {UUID} from 'io-ts-types';
import {EmailAddress} from '../../../types';
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
