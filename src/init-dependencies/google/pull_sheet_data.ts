import {Logger} from 'pino';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {Failure} from '../../types';

import {Auth, google, sheets_v4} from 'googleapis';
import {pipe} from 'fp-ts/lib/function';

export const pullGoogleSheetData =
  (auth: O.Option<Auth.GoogleAuth>) =>
  (
    logger: Logger,
    trainingSheetId: string
  ): TE.TaskEither<Failure, sheets_v4.Schema$Spreadsheet> => {
    if (O.isNone(auth)) {
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
              auth: auth.value,
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
