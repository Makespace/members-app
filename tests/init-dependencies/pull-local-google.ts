import {Logger} from 'pino';
import * as TE from 'fp-ts/TaskEither';
import * as gsheetData from '../data/google_sheet_data';
import {
  GoogleHelpers,
  GoogleSpreadsheetDataForSheet,
  GoogleSpreadsheetInitialMetadata,
} from '../../src/init-dependencies/google/pull_sheet_data';

const localPullGoogleSheetDataMetadata = (
  logger: Logger,
  trainingSheetId: string
): TE.TaskEither<string, GoogleSpreadsheetInitialMetadata> => {
  logger.debug(`Pulling local google sheet metadata '${trainingSheetId}'`);
  const sheet = gsheetData.TRAINING_SHEETS[trainingSheetId].metadata;
  return sheet ? TE.right(sheet) : TE.left('Spreadsheet not found');
};

const localPullGoogleSheetData = (
  logger: Logger,
  trainingSheetId: string,
  sheetName: string,
  _rowStart: number,
  _rowEnd: number,
  _columnStartIndex: number,
  _columnEndIndex: number
): TE.TaskEither<string, GoogleSpreadsheetDataForSheet> => {
  logger.debug(`Pulling local google sheet '${trainingSheetId}'`);
  const sheet = gsheetData.TRAINING_SHEETS[trainingSheetId].sheets[sheetName];
  return sheet ? TE.right(sheet) : TE.left('Sheet not found');
};

export const localGoogleHelpers: GoogleHelpers = {
  pullGoogleSheetData: localPullGoogleSheetData,
  pullGoogleSheetDataMetadata: localPullGoogleSheetDataMetadata,
};
