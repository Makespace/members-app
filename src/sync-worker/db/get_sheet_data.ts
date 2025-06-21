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
          (y) => {
            return y;
          },
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

const getPassedQuizResults =
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
            AND percentage = 100
            ORDER BY response_submitted DESC
            `,
            [sheetId, skip_member_numbers as any, skip_emails as any]
          ),
        reason =>
          `Failed to get passed quiz results for sheet '${sheetId}': ${(reason as Error).message}`
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

const getFailedQuizResults =
  (db: Client) =>
  (
    sheetId: string,
    skip_member_numbers: ReadonlyArray<number>,
    skip_emails: ReadonlyArray<string>,
    count: number
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
            AND percentage < 100
            ORDER BY response_submitted DESC
            LIMIT ?
            `,
            [sheetId, skip_member_numbers as any, skip_emails as any, count]
          ),
        reason =>
          `Failed to get failed quiz results for sheet '${sheetId}': ${(reason as Error).message}`
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
