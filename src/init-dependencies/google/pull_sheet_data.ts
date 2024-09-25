import {Logger} from 'pino';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import {Failure} from '../../types';

import {pipe} from 'fp-ts/lib/function';
import {sheets, sheets_v4} from '@googleapis/sheets';
import {GoogleAuth} from 'google-auth-library';
import {columnIndexToLetter} from '../../training-sheets/extract-metadata';
import {formatValidationErrors} from 'io-ts-reporters';

export type GoogleSpreadsheetInitialMetadata = sheets_v4.Schema$Spreadsheet & {
  readonly GoogleSpreadsheetInitialMetadata: unique symbol;
};

// Contains only a single sheet
export const GoogleSpreadsheetDataForSheet = t.strict({
  sheets: tt.nonEmptyArray(
    // Array always has length = 1 because this is data for a single sheet.
    t.strict({
      data: tt.nonEmptyArray(
        t.strict({
          rowData: tt.nonEmptyArray(
            t.strict({
              values: tt.nonEmptyArray(
                t.strict({
                  formattedValue: t.string,
                })
              ),
            })
          ),
        })
      ),
    })
  ),
});
export type GoogleSpreadsheetDataForSheet = t.TypeOf<
  typeof GoogleSpreadsheetDataForSheet
>;

export const pullGoogleSheetDataMetadata =
  (auth: GoogleAuth) =>
  (
    logger: Logger,
    trainingSheetId: string
  ): TE.TaskEither<string, GoogleSpreadsheetInitialMetadata> =>
    pipe(
      TE.tryCatch(
        () =>
          sheets({
            version: 'v4',
            auth,
          }).spreadsheets.get({
            spreadsheetId: trainingSheetId,
            includeGridData: false, // Only the metadata.
            fields: 'sheets(properties),properties(timeZone)', // Only the metadata about the sheets.
          }),
        reason => {
          logger.error(reason, 'Failed to get spreadsheet metadata');
          return `Failed to get training spreadsheet metadata ${trainingSheetId}`;
        }
      ),
      TE.map(resp => resp.data as GoogleSpreadsheetInitialMetadata)
    );

export const pullGoogleSheetData =
  (auth: GoogleAuth) =>
  (
    logger: Logger,
    trainingSheetId: string,
    sheetName: string,
    rowStart: number, // 1 indexed.
    rowEnd: number,
    columnStartIndex: number, // 0 indexed, converted to a letter.
    columnEndIndex: number
  ): TE.TaskEither<Failure, GoogleSpreadsheetDataForSheet> =>
    pipe(
      TE.tryCatch(
        () => {
          const ranges = [
            `${sheetName}!${columnIndexToLetter(columnStartIndex)}${rowStart}:${columnIndexToLetter(columnEndIndex)}${rowEnd}`,
          ];
          const fields = 'sheets(data(rowData(values(formattedValue))))';
          logger.info(
            'Querying sheet %s for fields %s range %s',
            trainingSheetId,
            fields,
            ranges
          );
          return sheets({
            version: 'v4',
            auth,
          }).spreadsheets.get({
            spreadsheetId: trainingSheetId,
            fields,
            ranges,
          });
        },
        reason => {
          logger.error(reason, 'Failed to get spreadsheet');
          return {
            // Expand failure reasons.
            message: `Failed to get training spreadsheet ${trainingSheetId}`,
          };
        }
      ),
      TE.map(resp => resp.data),
      TE.chain(data =>
        TE.fromEither(
          pipe(
            data,
            GoogleSpreadsheetDataForSheet.decode,
            E.mapLeft(e => ({
              message: `Failed to get all required google spreadsheet data from API response: ${formatValidationErrors(e).join(',')}`,
            }))
          )
        )
      )
    );

export interface GoogleHelpers {
  pullGoogleSheetData: ReturnType<typeof pullGoogleSheetData>;
  pullGoogleSheetDataMetadata: ReturnType<typeof pullGoogleSheetDataMetadata>;
}
