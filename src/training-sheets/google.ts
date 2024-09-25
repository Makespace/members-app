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
import {
  GoogleSheetMetadata,
  GoogleSheetMetadataInital,
  SpreadsheetData,
} from './extract-metadata';
import {GoogleSpreadsheetDataForSheet} from '../init-dependencies/google/pull_sheet_data';

// Bounds to prevent clearly broken parsing.
const MIN_RECOGNISED_MEMBER_NUMBER = 0;
const MAX_RECOGNISED_MEMBER_NUMBER = 10_000;

const MIN_VALID_TIMESTAMP_EPOCH_MS =
  1262304000_000 as EpochTimestampMilliseconds; // Year 2010
const MAX_VALID_TIMESTAMP_EPOCH_MS =
  4102444800_000 as EpochTimestampMilliseconds; // Year 2100

const FORM_RESPONSES_SHEET_REGEX = /^Form Responses [0-9]*/i;

const extractScore = (
  rowValue: string | undefined | null
): O.Option<{
  score: number;
  maxScore: number;
  percentage: number;
  fullMarks: boolean;
}> => {
  if (!rowValue) {
    return O.none;
  }
  const parts = rowValue.split(' / ');
  if (parts.length !== 2) {
    return O.none;
  }

  const score = parseInt(parts[0], 10);
  if (isNaN(score) || score < 0 || score > 100) {
    return O.none;
  }

  const maxScore = parseInt(parts[1], 10);
  if (isNaN(maxScore) || maxScore < 1 || maxScore > 100 || maxScore < score) {
    return O.none;
  }

  const percentage = Math.round((score / maxScore) * 100);

  // We don't say 'passed' incase the pass-rate is different for some reason.
  const fullMarks = score === maxScore;
  return O.some({
    score,
    maxScore,
    percentage,
    fullMarks,
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

const extractTimestamp = (
  timezone: string,
  rowValue: string | undefined | null
): O.Option<EpochTimestampMilliseconds> => {
  if (!rowValue) {
    return O.none;
  }
  try {
    const timestampEpochMS = (DateTime.fromFormat(
      rowValue,
      'dd/MM/yyyy HH:mm:ss',
      {
        setZone: true,
        zone: timezone,
      }
    ).toUnixInteger() * 1000) as EpochTimestampMilliseconds;
    if (
      isNaN(timestampEpochMS) ||
      !isFinite(timestampEpochMS) ||
      timestampEpochMS < MIN_VALID_TIMESTAMP_EPOCH_MS ||
      timestampEpochMS > MAX_VALID_TIMESTAMP_EPOCH_MS
    ) {
      return O.none;
    }
    return O.some(timestampEpochMS);
  } catch {
    return O.none;
  }
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
      ? extractEmail(
          row.values[metadata.mappedColumns.email.value].formattedValue
        )
      : O.none;
    const memberNumber = O.isSome(metadata.mappedColumns.memberNumber)
      ? extractMemberNumber(
          row.values[metadata.mappedColumns.memberNumber.value].formattedValue
        )
      : O.none;
    const score = extractScore(
      row.values[metadata.mappedColumns.score].formattedValue
    );
    const timestampEpochMS = extractTimestamp(
      timezone,
      row.values[metadata.mappedColumns.timestamp].formattedValue
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
    if (O.isNone(timestampEpochMS)) {
      logger.warn('Failed to extract timestamp from row, skipped row');
      logger.trace('Skipped quiz row: %o', row);
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
        timestampEpochMS: timestampEpochMS.value,
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
    timezone: string,
    eventsFromExclusive: O.Option<EpochTimestampMilliseconds>
  ) =>
  (
    spreadsheet: GoogleSpreadsheetDataForSheet
  ): ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>> => {
    const data = SpreadsheetData.decode(spreadsheet);
    if (E.isLeft(data)) {
      logger.warn('Skipping sheet %s due to missing data', trainingSheetId);
      return [];
    }
    return pipe(
      data.right.sheets[0].data[0].rowData,
      RA.map(
        extractFromRow(logger, metadata, equipmentId, trainingSheetId, timezone)
      ),
      RA.filterMap(e => e),
      RA.filter(
        e =>
          O.isNone(eventsFromExclusive) ||
          e.timestampEpochMS > eventsFromExclusive.value
      )
    );
  };

export const shouldPullFromSheet = (
  sheet: GoogleSheetMetadataInital
): boolean => FORM_RESPONSES_SHEET_REGEX.test(sheet.name);

export const columnBoundsRequired = (
  sheet: GoogleSheetMetadata
): [number, number] => {
  const colIndexes = Object.values(sheet.mappedColumns)
    .filter(col => typeof col === 'number' || O.isSome(col))
    .map(col => (typeof col === 'number' ? col : col.value));
  return [Math.min(...colIndexes), Math.max(...colIndexes)];
};
