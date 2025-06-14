// Dump the entire state of the internal database into a file which can be loaded and inspected locally.
// https://github.com/Makespace/members-app/issues/108
// The output of this is subject to change (inc. enable/disable) at any point including during patch version
// (non-breaking) updates to the program.

import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {
  areasTable,
  equipmentTable,
  membersTable,
  ownersTable,
  trainedMemberstable,
  trainersTable,
} from '../state';
import {ReadonlyRecord} from 'fp-ts/lib/ReadonlyRecord';

type TableName = string;
type TableRows = unknown;

export type SharedDatabaseDump = ReadonlyRecord<TableName, TableRows>;

export const dumpCurrentState =
  (db: BetterSQLite3Database) => (): SharedDatabaseDump =>
    Object.fromEntries(
      Object.entries({
        membersTable,
        equipmentTable,
        trainersTable,
        trainedMemberstable,
        areasTable,
        ownersTable,
      }).map(([tableName, table]) => [tableName, db.select().from(table).all()])
    );
