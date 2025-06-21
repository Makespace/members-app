import {Client} from '@libsql/client/.';
import {dbExecute} from '../../util';

// This table contains a copy of all the training sheet data currently in google.
// It is read only on requests from the frontend so it can be accelerated via read-replicas.
// We used to try and turn the google sheet data into events however this proved messier and messier
// once we needed to do things like cache the sheet data (parsing data is slow and prevents startup before healthcheck failure),
// do incremental pulls (parsing data is slow), only pull 1 bit of equipment at a time (otherwise it blocks the event loop).

const ensureSheetDataTableExists = (dbClient: Client) =>
  dbExecute(
    dbClient,
    `
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
        `,
    {}
  );

const ensureSheetDataSyncMetadataTableExists = (dbClient: Client) =>
  dbExecute(
    dbClient,
    `
        CREATE TABLE IF NOT EXISTS sheet_sync_metadata (
          sheet_id TEXT PRIMARY KEY,
          last_sync INTEGER
        );
        `,
    {}
  );

const ensureTroubleTicketDataTableExists = (dbClient: Client) =>
  dbExecute(
    dbClient,
    `
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
        `,
    {}
  );

export const ensureDBTablesExist = (dbClient: Client) =>
  Promise.all([
    ensureSheetDataTableExists(dbClient),
    ensureSheetDataSyncMetadataTableExists(dbClient),
    ensureTroubleTicketDataTableExists(dbClient),
  ]);
