import {Logger} from 'pino';
import * as TE from 'fp-ts/TaskEither';
import * as gsheetData from '../data/google_sheet_data';
import {
  GoogleHelpers,
  GoogleSpreadsheetDataForSheet,
  GoogleSpreadsheetInitialMetadata,
} from '../../src/init-dependencies/google/pull_sheet_data';
import {NonEmptyArray} from 'fp-ts/lib/NonEmptyArray';

const localPullGoogleSheetDataMetadata = (
  logger: Logger,
  trainingSheetId: string
): TE.TaskEither<string, GoogleSpreadsheetInitialMetadata> => {
  logger.debug(`Pulling local google sheet metadata '${trainingSheetId}'`);
  const sheet = gsheetData.GOOGLE_SHEETS[trainingSheetId].metadata;
  return sheet ? TE.right(sheet) : TE.left('Spreadsheet not found');
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const localPullGoogleSheetData = (
  logger: Logger,
  trainingSheetId: string,
  sheetName: string,
  rowStart: number,
  rowEnd: number,
  _columnStartIndex: number,
  _columnEndIndex: number
): TE.TaskEither<string, GoogleSpreadsheetDataForSheet> => {
  logger.debug(`Pulling local google sheet '${trainingSheetId}'`);
  const sheet = clone(
    gsheetData.GOOGLE_SHEETS[trainingSheetId].sheets[sheetName]
  );
  if (sheet) {
    const rowData = sheet.sheets[0].data[0].rowData!;
    if (rowStart > rowData.length) {
      return TE.left('Sheet no more data');
    }
    sheet.sheets[0].data[0].rowData = rowData.slice(
      rowStart - 1, // 1 indexed.
      rowEnd
    ) as NonEmptyArray<{
      values: NonEmptyArray<{
        formattedValue: string;
      }>;
    }>;
    return TE.right(sheet);
  }
  return TE.left('Sheet not found');
};

export const localGoogleHelpers: GoogleHelpers = {
  pullGoogleSheetData: localPullGoogleSheetData,
  pullGoogleSheetDataMetadata: localPullGoogleSheetDataMetadata,
};
