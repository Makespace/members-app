import {eq} from 'drizzle-orm';
import {SyncWorkerDependencies} from '../dependencies';
import {troubleTicketDataTable} from '../google/sheet-data-table';
import {GoogleDB} from '../google/db';

export const updateTroubleTicketCache =
  (googleDB: GoogleDB): SyncWorkerDependencies['updateTroubleTicketCache'] =>
  async (sheetId, data) => {
    // libsql executes batches atomically, preserving the old cache replacement semantics.
    await googleDB.batch([
      googleDB
        .delete(troubleTicketDataTable)
        .where(eq(troubleTicketDataTable.sheet_id, sheetId)),
      ...data.map(row => googleDB.insert(troubleTicketDataTable).values(row)),
    ]);
  };
