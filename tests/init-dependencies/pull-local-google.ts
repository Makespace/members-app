import {Logger} from 'pino';
import * as TE from 'fp-ts/TaskEither';
import * as gsheetData from '../data/google_sheet_data';
import {GoogleHelpers} from '../../src/init-dependencies/google/pull_sheet_data';

const localPullGoogleSheetData = (logger: Logger, trainingSheetId: string) => {
  logger.debug(`Pulling local google sheet '${trainingSheetId}'`);
  const sheet = gsheetData.TRAINING_SHEETS[trainingSheetId].data;
  return sheet
    ? TE.right(sheet)
    : TE.left({
        message: 'Sheet not found',
      });
};

export const localGoogleHelpers: GoogleHelpers = {
  pullGoogleSheetData: localPullGoogleSheetData,
  pullGoogleSheetDataMetadata: localPullGoogleSheetData,
};
