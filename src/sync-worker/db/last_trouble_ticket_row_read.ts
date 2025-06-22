import {Client, ResultSet} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as RA from 'fp-ts/ReadonlyArray';
import * as RR from 'fp-ts/ReadonlyRecord';
import * as O from 'fp-ts/Option';
import {SyncWorkerDependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import {formatValidationErrors} from 'io-ts-reporters';

const LastRowReadTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      sheet_name: t.string,
      last_row_index: t.union([t.number, t.null]),
    })
  ),
});
type LastRowReadTable = t.TypeOf<typeof LastRowReadTable>;

export const lastTroubleTicketRowRead =
  (googleDB: Client): SyncWorkerDependencies['lastTroubleTicketRowRead'] =>
  sheetId =>
    pipe(
      TE.tryCatch<string, ResultSet>(
        () =>
          googleDB.execute(
            `
            SELECT sheet_name, MAX(row_index) AS last_row_index
            FROM trouble_ticket_data
            WHERE sheet_id = ?
            GROUP BY sheet_name
            `,
            [sheetId]
          ),
        reason =>
          `Failed to get last row read for sheet '${sheetId}': ${(reason as Error).message}`
      ),
      TE.flatMapEither<ResultSet, string, LastRowReadTable>(data =>
        pipe(
          data,
          LastRowReadTable.decode,
          E.mapLeft(e => formatValidationErrors(e).join(','))
        )
      ),
      TE.map(data =>
        pipe(
          data.rows,
          RA.filterMap<LastRowReadTable['rows'][0], [string, number]>(r =>
            r.last_row_index ? O.some([r.sheet_name, r.last_row_index]) : O.none
          ),
          RR.fromEntries
        )
      )
    );
