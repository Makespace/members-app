// Dump the entire state of the internal database into a file which can be loaded and inspected locally.

import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {
  areasTable,
  equipmentTable,
  membersTable,
  ownersTable,
  trainedMemberstable,
  trainersTable,
  trainingQuizTable,
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
        trainingQuizTable,
      }).map(([tableName, table]) => [tableName, db.select().from(table).all()])
    );
