import {eq} from 'drizzle-orm';
import {SyncWorkerDependencies} from '../dependencies';
import {troubleTicketDataTable} from '../google/sheet-data-table';
import {ExternalStateDB} from '../external-state-db';

export const updateTroubleTicketCache =
  (extDB: ExternalStateDB): SyncWorkerDependencies['updateTroubleTicketCache'] =>
  async (sheetId, data) => {
    // libsql executes batches atomically, preserving the old cache replacement semantics.
    await extDB.batch([
      extDB
        .delete(troubleTicketDataTable)
        .where(eq(troubleTicketDataTable.sheet_id, sheetId)),
      ...data.map(row => extDB.insert(troubleTicketDataTable).values(row)),
    ]);
  };
