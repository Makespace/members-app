import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import {SyncWorkerDependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';

export const clearTrainingSheetCache =
  (db: Client): SyncWorkerDependencies['clearTrainingSheetCache'] =>
  sheetId =>
    pipe(
      TE.tryCatch(
        () =>
          db.execute('DELETE FROM sheet_data WHERE sheet_id = ?', [sheetId]),
        reason =>
          `Failed to delete sheet data for '${sheetId}': ${(reason as Error).message}`
      ),
      TE.flatMap(() =>
        TE.tryCatch(
          () =>
            db.execute('DELETE FROM sheet_sync_metadata WHERE sheet_id = ?', [
              sheetId,
            ]),
          reason =>
            `Failed to delete from sheet '${sheetId}' sync metadata: ${(reason as Error).message}`
        )
      ),
      TE.map(() => {})
    );
