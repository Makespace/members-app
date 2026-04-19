import * as TE from 'fp-ts/TaskEither';
import {SyncWorkerDependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {sheetSyncMetadataTable} from '../google/sheet-data-table';
import {ExternalStateDB} from '../external-state-db';

export const storeSync =
  (extDB: ExternalStateDB): SyncWorkerDependencies['storeSync'] =>
  (sheetId, date) =>
    pipe(
      TE.tryCatch(
        () =>
          extDB
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
