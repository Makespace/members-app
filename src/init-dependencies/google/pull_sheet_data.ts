import {Logger} from 'pino';
import * as TE from 'fp-ts/TaskEither';
import {Failure} from '../../types';

import {Auth, google, sheets_v4} from 'googleapis';
import {pipe} from 'fp-ts/lib/function';

export const pullGoogleSheetData =
  (auth: Auth.GoogleAuth | null) =>
  (
    logger: Logger,
    trainingSheetId: string
  ): TE.TaskEither<Failure, sheets_v4.Schema$Spreadsheet> => {
    if (auth === null) {
      return TE.left({
        message: 'Google connectivity disabled - failed to get spreadsheet',
      });
    }
    return pipe(
      TE.tryCatch(
        () =>
          google
            .sheets({
              version: 'v4',
              auth,
            })
            .spreadsheets.get({
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
  };
