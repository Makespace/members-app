import {Client} from '@libsql/client';
import {drizzle} from 'drizzle-orm/libsql';
import {
    createTables,
  sheetDataTable,
  sheetSyncMetadataTable,
  troubleTicketDataTable,
} from './google/sheet-data-table';
import { SyncWorkerDependencies } from './dependencies';


// This table contains a copy of all the training sheet data currently in google.
// It is read only on requests from the frontend so it can be accelerated via read-replicas.
// We used to try and turn the google sheet data into events however this proved messier and messier
// once we needed to do things like cache the sheet data (parsing data is slow and prevents startup before healthcheck failure),
// do incremental pulls (parsing data is slow), only pull 1 bit of equipment at a time (otherwise it blocks the event loop).
const ensureGoogleDBTablesExist =
  async (extDB: ExternalStateDB) => {
    for (const statement of createTables) {
      await extDB.run(statement);
    }
  };

export const initExternalStateDB = (client: Client) =>
  drizzle(client, {schema: {
    sheetDataTable,
    sheetSyncMetadataTable,
    troubleTicketDataTable,
  }});

export type ExternalStateDB = ReturnType<typeof initExternalStateDB>;

export const ensureExtDBTablesExist = (extDB: ExternalStateDB): SyncWorkerDependencies['ensureExtDBTablesExist'] => async () => {
    await ensureGoogleDBTablesExist(extDB);
}
