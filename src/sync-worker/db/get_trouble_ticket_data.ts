import {Client, ResultSet} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {TroubleTicketDataTable} from '../google/sheet-data-table';

export const getTroubleTicketData =
  (db: Client, sheetId: O.Option<string>) =>
  (): TE.TaskEither<string, O.Option<TroubleTicketDataTable['rows']>> => {
    if (O.isNone(sheetId)) {
      return TE.right(O.none);
    }
    return pipe(
      TE.tryCatch<string, ResultSet>(
        () =>
          db.execute(
            `
                SELECT *
                FROM trouble_ticket_data
                WHERE sheet_id = ?
                `,
            [sheetId.value]
          ),
        reason =>
          `Failed to get trouble sheet data from  '${sheetId.value}': ${(reason as Error).message}`
      ),
      TE.flatMapEither<ResultSet, string, TroubleTicketDataTable>(data =>
        pipe(
          data,
          TroubleTicketDataTable.decode,
          E.mapLeft(e => formatValidationErrors(e).join(','))
        )
      ),
      TE.map(data => data.rows),
      TE.map(O.some)
    );
  };
