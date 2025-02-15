import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';

import {Logger} from 'pino';
import {constructEvent, EventOfType} from '../types/domain-event';
import {v4} from 'uuid';
import {UUID} from 'io-ts-types';
import {DateTime} from 'luxon';
import {EpochTimestampMilliseconds} from '../read-models/shared-state/return-types';
import {GoogleSheetMetadata} from './extract-metadata';
import {GoogleSpreadsheetDataForSheet} from '../init-dependencies/google/pull_sheet_data';
import {lookup} from 'fp-ts/ReadonlyArray';
import {array} from 'fp-ts';

// Bounds to prevent clearly broken parsing.
const MIN_RECOGNISED_MEMBER_NUMBER = 0;
const MAX_RECOGNISED_MEMBER_NUMBER = 10_000;

const MAX_RECOGNISED_SCORE = 10_000;
const MIN_RECOGNISED_SCORE = 0;

const MIN_VALID_TIMESTAMP_EPOCH_MS =
  1546304461_000 as EpochTimestampMilliseconds; // Year 2019, Can't see any training results before this.

const FORM_RESPONSES_SHEET_REGEX = /^Form Responses [0-9]*/i;

const FORMATS_TO_TRY = [
  'dd/MM/yyyy HH:mm:ss',
  'MM/dd/yyyy HH:mm:ss',
  'M/dd/yyyy HH:mm:ss',
  'dd/M/yyyy HH:mm:ss',
  'M/d/yyyy HH:mm:ss',
  'd/M/yyyy HH:mm:ss',

  'dd/MM/yyyy H:m:s',
  'MM/dd/yyyy H:m:s',
  'M/dd/yyyy H:m:s',
  'dd/M/yyyy H:m:s',
  'M/d/yyyy H:m:s',
  'd/M/yyyy H:m:s',

  'yyyy-MM-dd HH:mm:ss',
];

const extractScore = (
  rowValue: string | undefined | null
): O.Option<{
  score: number;
  maxScore: number;
  percentage: number;
}> => {
  if (!rowValue) {
    return O.none;
  }
  const parts = rowValue.split(' / ');
  if (parts.length !== 2) {
    return O.none;
  }

  const score = parseInt(parts[0], 10);
  if (
    isNaN(score) ||
    score < MIN_RECOGNISED_SCORE ||
    score > MAX_RECOGNISED_SCORE
  ) {
    return O.none;
  }

  const maxScore = parseInt(parts[1], 10);
  if (
    isNaN(maxScore) ||
    maxScore < MIN_RECOGNISED_SCORE ||
    maxScore > MAX_RECOGNISED_SCORE ||
    maxScore < score
  ) {
    return O.none;
  }

  const percentage = Math.round((score / maxScore) * 100);

  return O.some({
    score,
    maxScore,
    percentage,
  });
};

const extractEmail = (
  rowValue: string | undefined | null
): O.Option<string> => {
  if (!rowValue) {
    return O.none;
  }
  // We may want to add further normalisation to user emails such as making them
  // all lowercase (when used as a id) to prevent user confusion.
  return O.some(rowValue.trim());
};

const extractMemberNumber = (
  rowValue: string | number | undefined | null
): O.Option<number> => {
  if (!rowValue) {
    return O.none;
  }
  if (typeof rowValue === 'string') {
    rowValue = parseInt(rowValue.trim(), 10);
  }

  if (
    isNaN(rowValue) ||
    rowValue <= MIN_RECOGNISED_MEMBER_NUMBER ||
    rowValue > MAX_RECOGNISED_MEMBER_NUMBER
  ) {
    return O.none;
  }

  return O.some(rowValue);
};

const timestampValid = (
  raw: string,
  timezone: string,
  ts: DateTime
): E.Either<string, EpochTimestampMilliseconds> => {
  let timestampEpochMS;
  try {
    if (ts.isValid) {
      timestampEpochMS = (ts.toUnixInteger() *
        1000) as EpochTimestampMilliseconds;
    } else {
      return E.left(
        `Failed to parse timestamp: ${raw} in timezone ${timezone}, reason: ${ts.invalidReason}`
      );
    }
  } catch (e) {
    let errStr = 'unknown';
    if (e instanceof Error) {
      errStr = `${e.name}: ${e.message}`;
    }
    return E.left(
      `Unable to parse timestamp: '${raw}' in timezone ${timezone}, err: ${errStr}`
    );
  }
  if (
    isNaN(timestampEpochMS) ||
    !isFinite(timestampEpochMS) ||
    timestampEpochMS < MIN_VALID_TIMESTAMP_EPOCH_MS ||
    timestampEpochMS > DateTime.utc().toUnixInteger() * 10 * 60 * 1000
  ) {
    return E.left(
      `Produced timestamp is invalid/out-of-range: '${raw}', timezone: '${timezone}' decoded to ${timestampEpochMS}`
    );
  }
  return E.right(timestampEpochMS);
};

export const extractTimestamp =
  (timezone: string) =>
  (
    rowValue: O.Option<string>
  ): E.Either<string, EpochTimestampMilliseconds> => {
    if (!rowValue || O.isNone(rowValue)) {
      return E.left('Missing column value');
    }
    let timestampEpochMS;
    for (const format of FORMATS_TO_TRY) {
      const ts = DateTime.fromFormat(rowValue.value, format, {
        setZone: true,
        zone: timezone,
      });
      timestampEpochMS = timestampValid(rowValue.value, timezone, ts);
      if (E.isRight(timestampEpochMS)) {
        return timestampEpochMS;
      }
    }
    return timestampEpochMS as E.Left<string>;
  };

const extractFromRow =
  (
    logger: Logger,
    metadata: GoogleSheetMetadata,
    equipmentId: UUID,
    trainingSheetId: string,
    timezone: string
  ) =>
  (row: {
    values: {formattedValue: string}[];
  }): O.Option<EventOfType<'EquipmentTrainingQuizResult'>> => {
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
      row.values,
      lookup(metadata.mappedColumns.timestamp),
      O.map(entry => entry.formattedValue),
      extractTimestamp(timezone)
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
        timestampEpochMS.left
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

export const shouldPullFromSheet = (sheet: {
  properties: {
    title: string;
  };
}): boolean => FORM_RESPONSES_SHEET_REGEX.test(sheet.properties.title);

export const columnBoundsRequired = (
  sheet: GoogleSheetMetadata
): [number, number] => {
  const colIndexes = Object.values(sheet.mappedColumns)
    .filter(col => typeof col === 'number' || O.isSome(col))
    .map(col => (typeof col === 'number' ? col : col.value));
  return [Math.min(...colIndexes), Math.max(...colIndexes)];
};
