import {Client, ResultSet} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {TroubleTicketDataTable} from '../google/sheet-data-table';

export const getTroubleTicketData =
  (db: Client) =>
  (sheetId: string): TE.TaskEither<string, TroubleTicketDataTable['rows']> =>
    pipe(
      TE.tryCatch<string, ResultSet>(
        () =>
          db.execute(
            `
            SELECT *
            FROM trouble_ticket_data
            WHERE sheet_id = ?
            `,
            [sheetId]
          ),
        reason =>
          `Failed to get trouble sheet data from  '${sheetId}': ${(reason as Error).message}`
      ),
      TE.flatMapEither<ResultSet, string, TroubleTicketDataTable>(data =>
        pipe(
          data,
          TroubleTicketDataTable.decode,
          E.mapLeft(e => formatValidationErrors(e).join(','))
        )
      ),
      TE.map(data => data.rows)
    );
