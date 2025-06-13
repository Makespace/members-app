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

const extractFromRow =
  (
    logger: Logger,
    metadata: GoogleSheetMetadata,
    equipmentId: UUID,
    trainingSheetId: string,
    timezone: string
  ) =>
  (
    row:
      | {
          values: {formattedValue: string}[] | undefined;
        }
      | Record<string, never>
  ): O.Option<EventOfType<'EquipmentTrainingQuizResult'>> => {
    if (!row.values) {
      return O.none;
    }
    const email = O.isSome(metadata.mappedColumns.email)
      ? pipe(
          row.values,
          lookup(metadata.mappedColumns.email.value),
          O.map(entry => entry.formattedValue),
          O.map(extractEmail),
          O.flatten
        )
      : O.none;
    const memberNumber = O.isSome(metadata.mappedColumns.memberNumber)
      ? pipe(
          row.values,
          lookup(metadata.mappedColumns.memberNumber.value),
          O.map(entry => entry.formattedValue),
          O.map(extractMemberNumber),
          O.flatten
        )
      : O.none;
    const score = pipe(
      row.values,
      lookup(metadata.mappedColumns.score),
      O.map(entry => entry.formattedValue),
      O.map(extractScore),
      O.flatten
    );
    const timestampEpochMS = pipe(
      lookup(metadata.mappedColumns.timestamp)(row.values),
      O.map(entry => entry.formattedValue),
      O.getOrElse<string | null>(() => null),
      extractTimestamp(timezone).decode
    );

    if (O.isNone(email) && O.isNone(memberNumber)) {
      // Note that some quizes only require the member number.
      logger.warn(
        'Failed to extract email or member number from row, skipping quiz result'
      );
      logger.trace('Skipped quiz row: %O', row);
      return O.none;
    }
    if (O.isNone(score)) {
      logger.warn('Failed to extract score from row, skipped row');
      logger.trace('Skipped quiz row: %o', row);
      return O.none;
    }
    if (E.isLeft(timestampEpochMS)) {
      logger.warn(
        'Failed to extract timestamp from row, skipped row, reason: %s',
        formatValidationErrors(timestampEpochMS.left)
      );
      return O.none;
    }
    return O.some(
      constructEvent('EquipmentTrainingQuizResult')({
        id: v4() as UUID,
        equipmentId,
        memberNumberProvided: O.isSome(memberNumber)
          ? memberNumber.value
          : null,
        emailProvided: O.isSome(email) ? email.value : null,
        trainingSheetId,
        timestampEpochMS: timestampEpochMS.right,
        ...score.value,
      })
    );
  };

export const extractGoogleSheetData =
  (
    logger: Logger,
    trainingSheetId: string,
    equipmentId: UUID,
    metadata: GoogleSheetMetadata,
    timezone: string
  ) =>
  (
    spreadsheet: GoogleSpreadsheetDataForSheet
  ): O.Option<ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>>> =>
    pipe(
      spreadsheet.sheets[0].data,
      array.lookup(0),
      O.flatMap(sheetData => O.fromNullable(sheetData.rowData)),
      O.flatMap(row_data =>
        O.some(
          pipe(
            row_data,
            RA.map(
              extractFromRow(
                logger,
                metadata,
                equipmentId,
                trainingSheetId,
                timezone
              )
            ),
            RA.filterMap(e => e)
          )
        )
      )
    );

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
