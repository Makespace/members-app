import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';

import {Logger} from 'pino';
import {constructEvent, EventOfType} from '../types/domain-event';
import {v4} from 'uuid';
import {UUID} from 'io-ts-types';
import {GoogleSheetMetadata} from './extract-metadata';
import {GoogleSpreadsheetDataForSheet} from '../training-sheets/google/pull_sheet_data';
import {lookup} from 'fp-ts/ReadonlyArray';
import {array} from 'fp-ts';
import {
  extractEmail,
  extractMemberNumber,
  extractScore,
  extractTimestamp,
} from './util';
import {formatValidationErrors} from 'io-ts-reporters';

const FORM_RESPONSES_SHEET_REGEX = /^Form Responses [0-9]*/i;



export const shouldPullFromSheet = (
  sheetId: string,
  sheet: {
    properties: {
      title: string;
    };
  }
): boolean =>
  // This specific sheet (woodworking handtools) breaks all the other conventions and puts its raw data in a sheet called Summary.
  (sheetId === '1CD_Va0th0dJmOSCjVGVCimrzkN7gKGjmMhifv7S9hY0' &&
    sheet.properties.title === 'Summary') ||
  FORM_RESPONSES_SHEET_REGEX.test(sheet.properties.title);

export const columnBoundsRequired = (
  sheet: GoogleSheetMetadata
): [number, number] => {
  const colIndexes = Object.values(sheet.mappedColumns)
    .filter(col => typeof col === 'number' || O.isSome(col))
    .map(col => (typeof col === 'number' ? col : col.value));
  return [Math.min(...colIndexes), Math.max(...colIndexes)];
};
