import {Logger} from 'pino';
import * as TE from 'fp-ts/TaskEither';
import {Failure} from '../../types';

import {pipe} from 'fp-ts/lib/function';
import {sheets, sheets_v4} from '@googleapis/sheets';
import {GoogleAuth} from 'google-auth-library';

export const pullGoogleSheetData =
  (auth: GoogleAuth) =>
  (
    logger: Logger,
    trainingSheetId: string
  ): TE.TaskEither<Failure, sheets_v4.Schema$Spreadsheet> =>
    pipe(
      TE.tryCatch(
        () =>
          sheets({
            version: 'v4',
            auth,
          }).spreadsheets.get({
            spreadsheetId: trainingSheetId,
            includeGridData: true,
          }),
        reason => {
          logger.error(reason, 'Failed to get spreadsheet');
          return {
            // Expand failure reasons.
            message: `Failed to get training spreadsheet ${trainingSheetId}`,
          };
        }
      ),
      TE.map(resp => resp.data)
    );
