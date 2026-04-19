import * as TE from 'fp-ts/TaskEither';
import {SyncWorkerDependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {sheetSyncMetadataTable} from '../google/sheet-data-table';
import {GoogleDB} from '../google/db';

export const storeSync =
  (googleDB: GoogleDB): SyncWorkerDependencies['storeSync'] =>
  (sheetId, date) =>
    pipe(
      TE.tryCatch(
        () =>
          googleDB
            .insert(sheetSyncMetadataTable)
            .values({sheet_id: sheetId, last_sync: date})
            .onConflictDoUpdate({
              target: sheetSyncMetadataTable.sheet_id,
              set: {last_sync: date},
            })
            .run(),
        reason =>
          `Failed to update sheet sync metadata: ${(reason as Error).message}`
      ),
      TE.map(() => {})
    );
