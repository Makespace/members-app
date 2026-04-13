import {Logger} from 'pino';
import * as gsheetData from '../data/google_sheet_data';
import {
  GoogleHelpers,
  GoogleSpreadsheetDataForSheet,
  GoogleSpreadsheetInitialMetadata,
} from '../../src/sync-worker/google/pull_sheet_data';
import {NonEmptyArray} from 'fp-ts/lib/NonEmptyArray';

const localPullGoogleSheetDataMetadata = async (
  logger: Logger,
  trainingSheetId: string
): Promise<GoogleSpreadsheetInitialMetadata> => {
  logger.debug(`Pulling local google sheet metadata '${trainingSheetId}'`);
  const sheet = gsheetData.GOOGLE_SHEETS[trainingSheetId].metadata;
  if (!sheet) {
    throw new Error('Spreadsheet not found');
  }
  return sheet; 
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const localPullGoogleSheetData = async (
  logger: Logger,
  trainingSheetId: string,
  sheetName: string,
  rowStart: number,
  rowEnd: number,
  _columnStartIndex: number,
  _columnEndIndex: number
): Promise<GoogleSpreadsheetDataForSheet> => {
  logger.debug(`Pulling local google sheet '${trainingSheetId}'`);
  const sheet = clone(
    gsheetData.GOOGLE_SHEETS[trainingSheetId].sheets[sheetName]
  );
  if (sheet) {
    const rowData = sheet.sheets[0].data[0].rowData!;
    sheet.sheets[0].data[0].rowData = rowData.slice(
      rowStart - 1, // 1 indexed.
      rowEnd
    ) as NonEmptyArray<{
      values: NonEmptyArray<{
        formattedValue: string;
      }>;
    }>;
    return sheet;
  }
  throw new Error('Sheet not found');
};

export const localGoogleHelpers: GoogleHelpers = {
  pullGoogleSheetData: localPullGoogleSheetData,
  pullGoogleSheetDataMetadata: localPullGoogleSheetDataMetadata,
};
