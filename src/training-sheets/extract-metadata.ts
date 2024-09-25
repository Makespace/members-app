import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';

import {Logger} from 'pino';
import {
  GoogleSpreadsheetDataForSheet,
  GoogleSpreadsheetInitialMetadata,
} from '../init-dependencies/google/pull_sheet_data';

const EMAIL_COLUMN_NAMES = ['email address', 'email'];

type GoogleSheetName = string;
// What we can get from an initial call to google sheets without any rows.
export interface GoogleSheetMetadataInital {
  name: GoogleSheetName;
  rowCount: number;
}
export interface GoogleSheetsMetadataInital {
  sheets: GoogleSheetMetadataInital[];
}

type ColumnLetter = string;
type ColumnIndex = number; // 0-indexed.
// Requires a subsequent call to get the column names.
export interface GoogleSheetMetadata {
  name: GoogleSheetName;
  rowCount: number;
  mappedColumns: {
    // Timestamp and score are required for every sheet, some other sheets only have email or member number.
    timestamp: ColumnIndex;
    score: ColumnIndex;
    email: O.Option<ColumnIndex>;
    memberNumber: O.Option<ColumnIndex>;
  };
}
export interface GoogleSheetsMetadata {
  sheets: GoogleSheetMetadata[];
  timezone: string;
}

export const MAX_COLUMN_INDEX = 25;
// Doesn't support beyond 26 columns but actually thats fine for the current data.
export const columnIndexToLetter = (index: ColumnIndex): ColumnLetter =>
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(index);

const SheetProperties = t.strict({
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

export const extractInitialGoogleSheetMetadata = (
  spreadsheet: GoogleSpreadsheetInitialMetadata
): E.Either<string, GoogleSheetsMetadataInital> =>
  pipe(
    spreadsheet,
    SheetProperties.decode,
    E.mapLeft(_e => 'Failed to extract initial google sheet metadata'),
    E.map(properties => ({
      sheets: properties.sheets.map(sheet => ({
        name: sheet.properties.title,
        rowCount: sheet.properties.gridProperties.rowCount,
      })),
    }))
  );

export const SpreadsheetData = t.strict({
  sheets: tt.nonEmptyArray(
    t.strict({
      data: tt.nonEmptyArray(
        t.strict({
          rowData: tt.nonEmptyArray(
            t.strict({
              values: tt.nonEmptyArray(
                t.strict({
                  formattedValue: t.string,
                })
              ),
            })
          ),
        })
      ),
    })
  ),
});

export const extractGoogleSheetMetadata =
  (logger: Logger) =>
  (
    initialMeta: GoogleSheetMetadataInital,
    spreadsheetDataForSheet: GoogleSpreadsheetDataForSheet
  ): O.Option<GoogleSheetMetadata> => {
    logger = logger.child({sheetName: initialMeta.name});
    const validated = SpreadsheetData.decode(spreadsheetDataForSheet);
    if (E.isLeft(validated)) {
      logger.warn('Failed to validate spreadsheet data, skipping sheet');
      return O.none;
    }

    const columnNames = validated.right.sheets[0].data[0].rowData[0].values.map(
      col => col.formattedValue
    );
    logger.trace('Found column names for sheet: %o', columnNames);
    const timestamp = RA.findIndex<string>(
      val => val.toLowerCase() === 'timestamp'
    )(columnNames);
    if (O.isNone(timestamp)) {
      logger.warn(
        'Failed to find timestamp column, skipping sheet: %s',
        initialMeta.name
      );
      return O.none;
    }
    const score = RA.findIndex<string>(val => val.toLowerCase() === 'score')(
      columnNames
    );
    if (O.isNone(score)) {
      logger.warn(
        'Failed to find score column, skipping sheet: %s',
        initialMeta.name
      );
      return O.none;
    }
    const memberNumber = RA.findIndex<string>(
      val => val.toLowerCase() === 'membership number'
    )(columnNames);
    const email = RA.findIndex<string>(val =>
      EMAIL_COLUMN_NAMES.includes(val.toLowerCase())
    )(columnNames);

    return O.some({
      ...initialMeta,
      mappedColumns: {
        timestamp: timestamp.value,
        score: score.value,
        email: email,
        memberNumber: memberNumber,
      },
    });
  };

const getTimezone = (metadata: GoogleSheetMetadata): string => {
  let timezone = spreadsheet.properties?.timeZone;
  if (!timezone || !DateTime.local().setZone(timezone).isValid) {
    // Not all the google form sheets are actually in Europe/London.
    // Issue first noticed because CI is in a different zone (UTC) than local test machine (BST).
    logger.info(
      `Unable to determine timezone for google sheet '${spreadsheet.properties?.title}', '${timezone}' - defaulting to Europe/London`
    );
    timezone = 'Europe/London';
  }
  return timezone;
}
