import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {SyncWorkerDependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {SheetSyncMetadataTable} from '../google/sheet-data-table';
import {formatValidationErrors} from 'io-ts-reporters';

export const lastSync =
  (googleDB: Client): SyncWorkerDependencies['lastSync'] =>
  sheetId =>
    pipe(
      TE.tryCatch(
        () =>
          googleDB.execute(
            'SELECT * FROM sheet_sync_metadata WHERE sheet_id = ?',
            [sheetId]
          ),
        reason =>
          `Failed to read sheet sync metadata: ${(reason as Error).message}`
      ),
      TE.flatMapEither(data =>
        pipe(
          data,
          SheetSyncMetadataTable.decode,
          E.mapLeft(e => formatValidationErrors(e).join(','))
        )
      ),
      TE.map(row =>
        pipe(
          row.rows,
          RA.head,
          O.map(r => r.last_sync)
        )
      )
    );
