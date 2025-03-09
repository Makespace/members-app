import {Logger} from 'pino';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';

import {pipe} from 'fp-ts/lib/function';
import {sheets} from '@googleapis/sheets';
import {GoogleAuth} from 'google-auth-library';
import {columnIndexToLetter} from '../../training-sheets/extract-metadata';
import {formatValidationErrors} from 'io-ts-reporters';
import {DateTime} from 'luxon';

const DEFAULT_TIMEZONE = 'Europe/London';

// Not all the google form sheets are actually in Europe/London.
// Issue first noticed because CI is in a different zone (UTC) than local test machine (BST).
export const GoogleTimezone = tt.withValidate(t.string, (input, context) =>
  pipe(
    t.string.validate(input, context),
    E.chain(timezoneRaw =>
      DateTime.local().setZone(timezoneRaw).isValid
        ? E.right(timezoneRaw)
        : E.left([])
    ),
    E.orElse(() => t.success(DEFAULT_TIMEZONE))
  )
);

export const GoogleSpreadsheetInitialMetadata = t.strict({
  properties: t.strict({
    timeZone: GoogleTimezone,
  }),
  sheets: t.array(
    t.strict({
      properties: t.strict({
        title: t.string,
        gridProperties: t.strict({
          rowCount: t.number,
        }),
      }),
    })
  ),
});
export type GoogleSpreadsheetInitialMetadata = t.TypeOf<
  typeof GoogleSpreadsheetInitialMetadata
>;

// Contains only a single sheet. Structure is a little verbose to match the part of the
// google api it is taken from.
export const GoogleSpreadsheetDataForSheet = t.strict({
  sheets: tt.nonEmptyArray(
    // Array always has length = 1 because this is data for a single sheet.
    t.strict({
      data: t.array(
        t.strict({
          rowData: t.union([
            t.array(
              t.union([
                t.strict({
                  values: t.array(
                    t.strict({
                      formattedValue: tt.withFallback(t.string, ''),
                    })
                  ),
                }),
                t.strict({}),
              ])
            ),
            t.undefined,
            t.null,
          ]),
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
      TE.map(resp => resp.data),
      TE.chain(data =>
        TE.fromEither(
          pipe(
            data,
            GoogleSpreadsheetInitialMetadata.decode,
            E.mapLeft(
              e =>
                `Failed to get google spreadsheet metadata from API response: ${formatValidationErrors(e).join(',')}`
            )
          )
        )
      )
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
  ): TE.TaskEither<string, GoogleSpreadsheetDataForSheet> =>
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
          logger.error(
            reason,
            'Failed to get training spreadsheet %s',
            trainingSheetId
          );
          return `Failed to get training spreadsheet ${trainingSheetId}`;
        }
      ),
      TE.map(resp => resp.data),
      TE.chain(data =>
        TE.fromEither(
          pipe(
            data,
            GoogleSpreadsheetDataForSheet.decode,
            E.mapLeft(
              e =>
                `Failed to get all required google spreadsheet data from API response: ${formatValidationErrors(e).join(',')}`
            )
          )
        )
      )
    );

export interface GoogleHelpers {
  pullGoogleSheetData: ReturnType<typeof pullGoogleSheetData>;
  pullGoogleSheetDataMetadata: ReturnType<typeof pullGoogleSheetDataMetadata>;
}
