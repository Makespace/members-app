import {Client, ResultSet} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {SheetDataTable} from '../google/sheet-data-table';

export const getSheetData =
  (googleDB: Client) =>
  (
    sheetId: string,
    from: O.Option<Date>
  ): TE.TaskEither<string, SheetDataTable['rows']> =>
    pipe(
      TE.tryCatch<string, ResultSet>(
        () =>
          O.isSome(from)
            ? googleDB.execute(
                `
            SELECT *
            FROM sheet_data
            WHERE sheet_id = ?
            AND response_submitted > ?
            `,
                [sheetId, from.value]
              )
            : googleDB.execute(
                `
            SELECT *
            FROM sheet_data
            WHERE sheet_id = ?
            `,
                [sheetId]
              ),
        reason =>
          `Failed to get sheet data for sheet '${sheetId}': ${(reason as Error).message}`
      ),
      TE.flatMapEither<ResultSet, string, SheetDataTable>(data =>
        pipe(
          data,
          SheetDataTable.decode,
          E.mapLeft(
            e =>
              'Failed to pull sheet data due to malformed data: ' +
              formatValidationErrors(e).join(',')
          )
        )
      ),
      TE.map(data => data.rows)
    );
