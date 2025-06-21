import {Client, ResultSet} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {SheetDataTable} from '../google/sheet-data-table';

export const getSheetData =
  (db: Client) =>
  (sheetId: string): TE.TaskEither<string, SheetDataTable['rows']> =>
    pipe(
      TE.tryCatch<string, ResultSet>(
        () =>
          db.execute(
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
