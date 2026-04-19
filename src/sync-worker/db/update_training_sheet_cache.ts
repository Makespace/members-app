import {eq} from 'drizzle-orm';
import {SyncWorkerDependencies} from '../dependencies';
import {sheetDataTable} from '../google/sheet-data-table';
import {GoogleDB} from '../google/db';

export const updateTrainingSheetCache =
  (
    googleDB: GoogleDB
  ): SyncWorkerDependencies['updateTrainingSheetCache'] =>
  async (sheetId, newData) => {
    // libsql executes batches atomically, preserving the old cache replacement semantics.
    await googleDB.batch([
      googleDB
        .delete(sheetDataTable)
        .where(eq(sheetDataTable.sheet_id, sheetId)),
      ...newData.map(row => googleDB.insert(sheetDataTable).values(row)),
    ]);
  };
