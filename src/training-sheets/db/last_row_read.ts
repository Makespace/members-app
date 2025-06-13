import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import {SyncWorkerDependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';

export const lastRowRead =
  (db: Client): SyncWorkerDependencies['lastRowRead'] =>
  (troubleTicketId) =>
    pipe(
      TE.tryCatch(
        () =>
          db.execute(
            'INSERT INTO sheet_sync_metadata(sheet_id, last_sync) VALUES (?, ?) ON CONFLICT (sheet_id) DO UPDATE SET last_sync=excluded.last_sync',
            [troubleTicketId, date]
          ),
        reason =>
          `Failed to update sheet sync metadata: ${(reason as Error).message}`
      ),
      TE.map(() => {})
    );
