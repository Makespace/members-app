import {ExtractTablesWithRelations} from 'drizzle-orm';
import {SQLiteTransaction} from 'drizzle-orm/sqlite-core';
import Database from 'better-sqlite3';

export type DatabaseTransaction = SQLiteTransaction<"sync", Database.RunResult, Record<string, never>, ExtractTablesWithRelations<Record<string, never>>>;
