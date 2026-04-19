import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {sql} from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const sheetDataTable = sqliteTable(
  'sheet_data',
  {
    sheet_id: text('sheet_id').notNull(),
    sheet_name: text('sheet_name').notNull(),
    row_index: integer('row_index').notNull(),
    response_submitted: integer('response_submitted', {
      mode: 'timestamp_ms',
    }).notNull(),
    member_number_provided: integer('member_number_provided'),
    email_provided: text('email_provided'),
    score: integer('score').notNull(),
    max_score: integer('max_score').notNull(),
    percentage: integer('percentage').notNull(),
    cached_at: integer('cached_at', {mode: 'timestamp_ms'}).notNull(),
  },
  table => ({
    sheetDataSheetIdIdx: index('sheet_data_sheet_id_idx').on(table.sheet_id),
  })
);

const createSheetDataTable = sql`
  CREATE TABLE IF NOT EXISTS sheet_data (
    sheet_id TEXT,
    sheet_name TEXT,
    row_index INTEGER,
    response_submitted INTEGER,
    member_number_provided INTEGER,
    email_provided TEXT,
    score INTEGER,
    max_score INTEGER,
    percentage INTEGER,
    cached_at INTEGER
  );
`;

export const sheetSyncMetadataTable = sqliteTable(
  'sheet_sync_metadata',
  {
    sheet_id: text('sheet_id').primaryKey(),
    last_sync: integer('last_sync', {mode: 'timestamp_ms'}).notNull(),
  }
);

const createSheetSyncMetadataTable = sql`
  CREATE TABLE IF NOT EXISTS sheet_sync_metadata (
    sheet_id TEXT PRIMARY KEY,
    last_sync INTEGER
  );
`;

export const troubleTicketDataTable = sqliteTable(
  'trouble_ticket_data',
  {
    sheet_id: text('sheet_id').notNull(),
    sheet_name: text('sheet_name').notNull(),
    row_index: integer('row_index').notNull(),
    response_submitted: integer('response_submitted', {
      mode: 'timestamp_ms',
    }).notNull(),
    cached_at: integer('cached_at', {mode: 'timestamp_ms'}).notNull(),
    submitted_email: text('submitted_email'),
    submitted_equipment: text('submitted_equipment'),
    submitted_name: text('submitted_name'),
    submitted_membership_number: integer('submitted_membership_number'),
    submitted_response_json: text('submitted_response_json').notNull(),
  },
  table => ({
    troubleTicketDataSheetIdIdx: index('trouble_ticket_data_sheet_id_idx').on(
      table.sheet_id
    ),
  })
);

const createTroubleTicketDataTable = sql`
  CREATE TABLE IF NOT EXISTS trouble_ticket_data (
    sheet_id TEXT,
    sheet_name TEXT,
    row_index INTEGER,
    response_submitted INTEGER,
    cached_at INTEGER,
    submitted_email TEXT,
    submitted_equipment TEXT,
    submitted_name TEXT,
    submitted_membership_number INTEGER,
    submitted_response_json TEXT
  );
`;

const createSheetDataSheetIdIndex = sql`
  CREATE INDEX IF NOT EXISTS sheet_data_sheet_id_idx ON sheet_data (sheet_id);
`;

const createTroubleTicketDataSheetIdIndex = sql`
  CREATE INDEX IF NOT EXISTS trouble_ticket_data_sheet_id_idx ON trouble_ticket_data (sheet_id);
`;

export const createTables = [
  createSheetDataTable,
  createSheetSyncMetadataTable,
  createTroubleTicketDataTable,
  createSheetDataSheetIdIndex,
  createTroubleTicketDataSheetIdIndex,
];

export const SheetDataTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      sheet_id: t.string,
      sheet_name: t.string,
      row_index: t.Integer,
      response_submitted: tt.DateFromNumber,
      member_number_provided: t.union([t.Integer, t.null]),
      email_provided: t.union([t.string, t.null]),
      score: t.Integer,
      max_score: t.Integer,
      percentage: t.Integer,
      cached_at: tt.DateFromNumber,
    })
  ),
});
export type SheetDataTable = t.TypeOf<typeof SheetDataTable>;

export const TroubleTicketDataTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      sheet_id: t.string,
      sheet_name: t.string,
      row_index: t.Integer,
      response_submitted: tt.DateFromNumber,
      cached_at: tt.DateFromNumber,
      // Do not trust provided data - it is not verified.
      submitted_email: t.union([t.string, t.null]),
      submitted_equipment: t.union([t.string, t.null]),
      submitted_name: t.union([t.string, t.null]),
      submitted_membership_number: t.union([t.Integer, t.null]),
      submitted_response_json: t.string,
    })
  ),
});
export type TroubleTicketDataTable = t.TypeOf<typeof TroubleTicketDataTable>;
