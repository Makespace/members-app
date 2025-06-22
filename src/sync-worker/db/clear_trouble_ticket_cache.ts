import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import {SyncWorkerDependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';

export const clearTroubleTicketCache =
  (googleDB: Client): SyncWorkerDependencies['clearTroubleTicketCache'] =>
  troubleTicketSheetId =>
    pipe(
      TE.tryCatch(
        () =>
          googleDB.execute(
            'DELETE FROM trouble_ticket_data WHERE sheet_id = ?',
            [troubleTicketSheetId]
          ),
        reason =>
          `Failed to delete trouble ticket data for '${troubleTicketSheetId}': ${(reason as Error).message}`
      ),
      TE.flatMap(() =>
        TE.tryCatch(
          () =>
            googleDB.execute(
              'DELETE FROM sheet_sync_metadata WHERE sheet_id = ?',
              [troubleTicketSheetId]
            ),
          reason =>
            `Failed to delete from sheet '${troubleTicketSheetId}' sync metadata: ${(reason as Error).message}`
        )
      ),
      TE.map(() => {})
    );
