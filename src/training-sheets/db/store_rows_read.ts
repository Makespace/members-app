import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {SyncWorkerDependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {inspect} from 'node:util';

export const storeRowsRead =
  (db: Client): SyncWorkerDependencies['storeRowsRead'] =>
  data =>
    pipe(
      data,
      RA.map(entry =>
        TE.tryCatch(
          () =>
            db.execute(
              `INSERT INTO sheet_data(
                sheet_id, sheet_name, row_index, member_number_provided, email_provided, score, max_score, percentage, cached_at
            ) VALUES (
                $sheet_id, $sheet_name, $row_index, $member_number_provided, $email_provided, $score, $max_score, $percentage, $cached_at
            )`,
              entry
            ),
          reason =>
            `Failed to insert sheet data '${inspect(entry)}': ${(reason as Error).message}`
        )
      ),
      TE.sequenceArray,
      TE.map(() => {})
    );
