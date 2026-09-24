import {sql} from 'drizzle-orm';
import {integer, sqliteTable, text} from 'drizzle-orm/sqlite-core';

// The result of the last look at each recorded equipment-guide address. This
// is a cache of something outside the app - the guide site - so it lives with
// the other external state rather than in the event log: nothing here is a
// fact about Makespace, only about what a web request found this morning.
export const guideLinkCheckTable = sqliteTable('guide_link_checks', {
  equipmentId: text('equipmentId').primaryKey(),
  url: text('url').notNull(),
  // The HTTP status, or null when the request never got one (DNS, timeout).
  status: integer('status'),
  reachable: integer('reachable', {mode: 'boolean'}).notNull(),
  checkedAt: integer('checkedAt', {mode: 'timestamp_ms'}).notNull(),
});

const createGuideLinkCheckTable = sql`
  CREATE TABLE IF NOT EXISTS guide_link_checks (
    equipmentId TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    status INTEGER,
    reachable INTEGER NOT NULL,
    checkedAt INTEGER NOT NULL
  );
`;

export const createTables = [createGuideLinkCheckTable];
