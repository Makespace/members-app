import {eq, isNull} from 'drizzle-orm';
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
      // Housekeeping: all-NULL rows left behind by an old sync bug are
      // invisible to the sheet_id-scoped replacement above (NULL never
      // matches =), so they would otherwise persist forever and make the
      // ingest report skipped rows on every cycle. Prod carried 542 of them.
      extDB
        .delete(troubleTicketDataTable)
        .where(isNull(troubleTicketDataTable.sheet_id)),
      ...data.map(row => extDB.insert(troubleTicketDataTable).values(row)),
    ]);
  };
