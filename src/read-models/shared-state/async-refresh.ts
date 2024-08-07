/* eslint-disable unused-imports/no-unused-vars */
import {Client} from '@libsql/client/.';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';

export const asyncRefresh = (
  eventStoreDb: Client,
  readModelDb: BetterSQLite3Database
) => {
  return () => async () => {};
};
