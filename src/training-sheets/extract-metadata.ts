import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';

import {Logger} from 'pino';
import {GoogleSpreadsheetDataForSheet} from '../init-dependencies/google/pull_sheet_data';
import {array} from 'fp-ts';
import {pipe} from 'fp-ts/lib/function';

const EMAIL_COLUMN_NAMES = ['email address', 'email'];

export type GoogleSheetName = string;

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

export const MAX_COLUMN_INDEX = 25;
// Doesn't support beyond 26 columns but actually thats fine for the current data.
export const columnIndexToLetter = (index: ColumnIndex): ColumnLetter =>
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(index);

export const extractGoogleSheetMetadata =
  (logger: Logger) =>
  (
    initialMeta: {
      properties: {title: string; gridProperties: {rowCount: number}};
    },
    firstRowData: GoogleSpreadsheetDataForSheet
  ): O.Option<GoogleSheetMetadata> => {
    logger = logger.child({sheetName: initialMeta.properties.title});
    const columnNames: O.Option<string[]> = pipe(
      firstRowData.sheets[0].data,
      array.lookup(0),
      O.flatMap(sheetData => O.fromNullable(sheetData.rowData)),
      O.flatMap(array.lookup(0)),
      O.flatMap(firstRowData =>
        O.some(firstRowData.values.map(col => col.formattedValue))
      )
    );
    if (O.isNone(columnNames)) {
      logger.error('Found no column names for sheet, skipping sheet');
      return O.none;
    }
    logger.trace('Found column names for sheet: %o', columnNames);
    const timestamp = RA.findIndex<string>(
      val => val.toLowerCase() === 'timestamp'
    )(columnNames.value);
    if (O.isNone(timestamp)) {
      logger.warn('Failed to find timestamp column, skipping sheet');
      return O.none;
    }
    const score = RA.findIndex<string>(val => val.toLowerCase() === 'score')(
      columnNames.value
    );
    if (O.isNone(score)) {
      logger.warn(
        'Failed to find score column, skipping sheet: %s',
        initialMeta.properties.title
      );
      return O.none;
    }
    const memberNumber = RA.findIndex<string>(
      val => val.toLowerCase() === 'membership number'
    )(columnNames.value);
    const email = RA.findIndex<string>(val =>
      EMAIL_COLUMN_NAMES.includes(val.toLowerCase())
    )(columnNames.value);

    return O.some({
      name: initialMeta.properties.title,
      rowCount: initialMeta.properties.gridProperties.rowCount,
      mappedColumns: {
        timestamp: timestamp.value,
        score: score.value,
        email: email,
        memberNumber: memberNumber,
      },
    });
  };
