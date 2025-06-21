import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {SyncWorkerDependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {inspect} from 'node:util';
import {Logger} from 'pino';

export const storeTrainingSheetRowsRead =
  (
    db: Client,
    logger: Logger
  ): SyncWorkerDependencies['storeTrainingSheetRowsRead'] =>
  data =>
    pipe(
      data,
      RA.chunksOf(50),
      RA.map(entries =>
        TE.tryCatch(
          async () => {
            logger.info(
              `Writing ${entries.length} rows to sheet_data as a batch, first row: ${inspect(entries[0])}`
            );
            await db.batch(
              entries.map(entry => ({
                sql: `INSERT INTO sheet_data(
                      sheet_id, sheet_name, row_index, response_submitted, member_number_provided, email_provided, score, max_score, percentage, cached_at
                  ) VALUES (
                      $sheet_id, $sheet_name, $row_index, $response_submitted, $member_number_provided, $email_provided, $score, $max_score, $percentage, $cached_at
                  )`,
                args: entry,
              }))
            );
          },
          reason =>
            `Failed to insert sheet data '${inspect(entries)}': ${(reason as Error).message}`
        )
      ),
      TE.sequenceArray,
      TE.map(() => {})
    );
