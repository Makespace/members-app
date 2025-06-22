import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {SyncWorkerDependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {inspect} from 'node:util';

export const storeTroubleTicketRowsRead =
  (googleDB: Client): SyncWorkerDependencies['storeTroubleTicketRowsRead'] =>
  data =>
    pipe(
      data,
      RA.map(entry =>
        TE.tryCatch(
          () =>
            googleDB.execute(
              `INSERT INTO trouble_ticket_data(
                sheet_id, sheet_name, row_index, response_submitted, cached_at, submitted_email, submitted_equipment, submitted_name, submitted_membership_number, submitted_response_json
            ) VALUES (
                $sheet_id, $sheet_name, $row_index, $response_submitted, $cached_at, $submitted_email, $submitted_equipment, $submitted_name, $submitted_membership_number, $submitted_response_json
            )`,
              entry
            ),
          reason =>
            `Failed to insert trouble ticket data '${inspect(entry)}': ${(reason as Error).message}`
        )
      ),
      TE.sequenceArray,
      TE.map(() => {})
    );
