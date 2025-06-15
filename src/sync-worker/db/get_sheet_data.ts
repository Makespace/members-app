import {Client, ResultSet} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {SheetDataTable} from '../google/sheet-data-table';

export const getSheetData =
  (db: Client) =>
  (
    sheetId: string,
    skip_member_numbers: ReadonlyArray<number>,
    skip_emails: ReadonlyArray<string>
  ): TE.TaskEither<string, SheetDataTable['rows']> =>
    pipe(
      TE.tryCatch<string, ResultSet>(
        () =>
          db.execute(
            `
            SELECT *
            FROM sheet_data
            WHERE sheet_id = ?
            AND member_number_provided NOT IN ?
            AND email_provided NOT IN ?
            `,
            [sheetId, skip_member_numbers as any, skip_emails as any]
          ),
        reason =>
          `Failed to get sheet data for sheet '${sheetId}': ${(reason as Error).message}`
      ),
      TE.flatMapEither<ResultSet, string, SheetDataTable>(data =>
        pipe(
          data,
          SheetDataTable.decode,
          E.mapLeft(e => formatValidationErrors(e).join(','))
        )
      ),
      TE.map(data => data.rows)
    );
