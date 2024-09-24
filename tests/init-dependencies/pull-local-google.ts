import {Logger} from 'pino';
import * as TE from 'fp-ts/TaskEither';
import * as gsheetData from '../data/google_sheet_data';
import {PullSheetData} from '../../src/read-models/shared-state/async-apply-external-event-sources';

export const localPullGoogleSheetData: PullSheetData = (
  logger: Logger,
  trainingSheetId: string
) => {
  logger.debug(`Pulling local google sheet '${trainingSheetId}'`);
  const sheet = gsheetData.TRAINING_SHEETS[trainingSheetId].data;
  return sheet
    ? TE.right(sheet)
    : TE.left({
        message: 'Sheet not found',
      });
};
