import {eq} from 'drizzle-orm';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {SyncWorkerDependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {sheetSyncMetadataTable} from '../google/sheet-data-table';
import {ExternalStateDB} from '../external-state-db';

export const lastSync =
  (extDB: ExternalStateDB): SyncWorkerDependencies['lastSync'] =>
  sheetId =>
    pipe(
      TE.tryCatch(
        () =>
          extDB
            .select()
            .from(sheetSyncMetadataTable)
            .where(eq(sheetSyncMetadataTable.sheet_id, sheetId)),
        reason =>
          `Failed to read sheet sync metadata: ${(reason as Error).message}`
      ),
      TE.map(row =>
        pipe(
          row,
          RA.head,
          O.map(r => r.last_sync)
        )
      )
    );
