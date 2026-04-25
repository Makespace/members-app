import {eq} from 'drizzle-orm';
import {SyncWorkerDependencies} from '../dependencies';
import {sheetDataTable} from '../google/sheet-data-table';
import {ExternalStateDB} from '../external-state-db';

export const updateTrainingSheetCache =
  (
    extDB: ExternalStateDB
  ): SyncWorkerDependencies['updateTrainingSheetCache'] =>
  async (sheetId, newData) => {
    // libsql executes batches atomically, preserving the old cache replacement semantics.
    await extDB.batch([
      extDB
        .delete(sheetDataTable)
        .where(eq(sheetDataTable.sheet_id, sheetId)),
      ...newData.map(row => extDB.insert(sheetDataTable).values(row)),
    ]);
  };
