import {Logger} from 'pino';
import * as TE from 'fp-ts/TaskEither';
import {Failure} from '../../types';

import {pipe} from 'fp-ts/lib/function';
import {sheets, sheets_v4} from '@googleapis/sheets';
import {GoogleAuth} from 'google-auth-library';

export type GoogleSpreadsheetInitialMetadata = sheets_v4.Schema$Spreadsheet & {
  readonly GoogleSpreadsheetInitialMetadata: unique symbol;
};

export type GoogleSpreadsheetDataForSheet = sheets_v4.Schema$Spreadsheet & {
  readonly GoogleSpreadsheetDataForSheet: unique symbol;
};

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
            fields: 'sheets(properties)', // Only the metadata about the sheets.
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
    rowEnd: number
  ): TE.TaskEither<Failure, GoogleSpreadsheetDataForSheet> =>
    pipe(
      TE.tryCatch(
        () =>
          sheets({
            version: 'v4',
            auth,
          }).spreadsheets.get({
            spreadsheetId: trainingSheetId,
            fields: 'sheets(data(rowData(values(formattedValue))))',
            ranges: [`${sheetName}!${rowStart}:${rowEnd}`],
          }),
        reason => {
          logger.error(reason, 'Failed to get spreadsheet');
          return {
            // Expand failure reasons.
            message: `Failed to get training spreadsheet ${trainingSheetId}`,
          };
        }
      ),
      TE.map(resp => resp.data as GoogleSpreadsheetDataForSheet)
    );

export interface GoogleHelpers {
  pullGoogleSheetData: ReturnType<typeof pullGoogleSheetData>;
  pullGoogleSheetDataMetadata: ReturnType<typeof pullGoogleSheetDataMetadata>;
}
