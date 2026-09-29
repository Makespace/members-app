import {addGmailMessageColumns, createGmailTables} from './gmail/gmail-message-table';
import {Client} from '@libsql/client';
import {drizzle} from 'drizzle-orm/libsql';
import {
  createTables as createGoogleTables,
  sheetDataTable,
  sheetSyncMetadataTable,
  troubleTicketDataTable,
} from './google/sheet-data-table';
import {
  addRecurlyColumns,
  createTables as createRecurlyTables,
  recurlyInvoiceTable,
  recurlySubscriptionTable,
  recurlySyncMetadataTable,
  recurlyTransactionTable,
} from './recurly/recurly-data-table';
import {
  createTables as createGuideLinkTables,
  guideLinkCheckTable,
} from './guide-links/guide-link-table';
import { SyncWorkerDependencies } from './dependencies';


// Adds a column to a cache that may already have it. SQLite has no
// ADD COLUMN IF NOT EXISTS, so the only way to be idempotent is to try and
// forgive the one error that means "already done".
const runForgivingDuplicateColumn = async (
  extDB: ExternalStateDB,
  statement: Parameters<ExternalStateDB['run']>[0]
) => {
  try {
    await extDB.run(statement);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/duplicate column name/i.test(message)) {
      throw error;
    }
  }
};

// This table contains a copy of all the training sheet data currently in google.
// It is read only on requests from the frontend so it can be accelerated via read-replicas.
// We used to try and turn the google sheet data into events however this proved messier and messier
// once we needed to do things like cache the sheet data (parsing data is slow and prevents startup before healthcheck failure),
// do incremental pulls (parsing data is slow), only pull 1 bit of equipment at a time (otherwise it blocks the event loop).
const ensureGoogleDBTablesExist =
  async (extDB: ExternalStateDB) => {
    for (const statement of createGoogleTables) {
      await extDB.run(statement);
    }
  };

const ensureRecurlyDBTablesExist =
  async (extDB: ExternalStateDB) => {
    for (const statement of createRecurlyTables) {
      await extDB.run(statement);
    }
    // See addRecurlyColumns: a column added to a cache that already exists
    // needs an ALTER, and SQLite has no ADD COLUMN IF NOT EXISTS.
    for (const statement of addRecurlyColumns) {
      await runForgivingDuplicateColumn(extDB, statement);
    }
  };

export const initExternalStateDB = (client: Client) =>
  drizzle(client, {schema: {
    sheetDataTable,
    sheetSyncMetadataTable,
    troubleTicketDataTable,
    recurlySubscriptionTable,
    recurlyInvoiceTable,
    recurlyTransactionTable,
    recurlySyncMetadataTable,
    guideLinkCheckTable,
  }});

export type ExternalStateDB = ReturnType<typeof initExternalStateDB>;

export const ensureExtDBTablesExist = (extDB: ExternalStateDB): SyncWorkerDependencies['ensureExtDBTablesExist'] => async () => {
    await ensureGoogleDBTablesExist(extDB);
    await ensureRecurlyDBTablesExist(extDB);
    await ensureGmailTablesExist(extDB);
    await ensureGuideLinkTablesExist(extDB);
}

const ensureGuideLinkTablesExist = async (extDB: ExternalStateDB) => {
    for (const statement of createGuideLinkTables) {
        await extDB.run(statement);
    }
}

const ensureGmailTablesExist = async (extDB: ExternalStateDB) => {
    for (const statement of createGmailTables) {
        await extDB.run(statement);
    }
    for (const statement of addGmailMessageColumns) {
        await runForgivingDuplicateColumn(extDB, statement);
    }
}
