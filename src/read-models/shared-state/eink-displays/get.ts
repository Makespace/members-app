import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {asc, eq} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {einkDisplaysTable} from '../state';

export type EinkDisplayAssignment = {
  displayNumber: number;
  equipmentId: UUID;
};

// The machine a display shows, if it has been set up.
export const getEinkDisplayAssignment =
  (db: BetterSQLite3Database) =>
  (displayNumber: number): O.Option<UUID> =>
    O.fromNullable(
      db
        .select({equipmentId: einkDisplaysTable.equipmentId})
        .from(einkDisplaysTable)
        .where(eq(einkDisplaysTable.displayNumber, displayNumber))
        .get()?.equipmentId
    );

export const getAllEinkDisplayAssignments =
  (db: BetterSQLite3Database) => (): ReadonlyArray<EinkDisplayAssignment> =>
    db
      .select()
      .from(einkDisplaysTable)
      .orderBy(asc(einkDisplaysTable.displayNumber))
      .all();
