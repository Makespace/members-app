import {SyncWorkerDependencies} from '../dependencies';
import {GoogleDB} from './db';
import {createTables} from './sheet-data-table';

// This table contains a copy of all the training sheet data currently in google.
// It is read only on requests from the frontend so it can be accelerated via read-replicas.
// We used to try and turn the google sheet data into events however this proved messier and messier
// once we needed to do things like cache the sheet data (parsing data is slow and prevents startup before healthcheck failure),
// do incremental pulls (parsing data is slow), only pull 1 bit of equipment at a time (otherwise it blocks the event loop).

export const ensureGoogleDBTablesExist =
  (googleDB: GoogleDB): SyncWorkerDependencies['ensureGoogleDBTablesExist'] =>
  async () => {
    for (const statement of createTables) {
      await googleDB.run(statement);
    }
  };
