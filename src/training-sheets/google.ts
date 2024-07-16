import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';

import {Logger} from 'pino';
import {constructEvent} from '../types/domain-event';
import {sheets_v4} from 'googleapis';
import {v4} from 'uuid';
import {UUID} from 'io-ts-types';
import {DateTime} from 'luxon';
import {QzEvent} from '../types/qz-event';

// Bounds to prevent clearly broken parsing.
const MIN_RECOGNISED_MEMBER_NUMBER = 0;
const MAX_RECOGNISED_MEMBER_NUMBER = 1_000_000;

const extractRowFormattedValues = (
  row: sheets_v4.Schema$RowData
): O.Option<string[]> => {
  if (row.values) {
    return O.some(row.values.map(cd => cd.formattedValue ?? ''));
  }
  return O.none;
};

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
  rowValue: string | undefined | null
): O.Option<number> => {
  if (!rowValue) {
    return O.none;
  }
  try {
    return O.some(
      DateTime.fromFormat(rowValue, 'dd/MM/yyyy HH:mm:ss').toUnixInteger()
    );
  } catch {
    return O.none;
  }
};

const EMAIL_COLUMN_NAMES = ['email address', 'email'];

type SheetInfo = {
  columnIndexes: {
    timestamp: number;
    email: number;
    score: number;
    memberNumber: number;
  };
  columnNames: string[];
};

const extractQuizSheetInformation = (
  logger: Logger,
  firstRow: sheets_v4.Schema$RowData
): O.Option<SheetInfo> => {
  const columnNames = extractRowFormattedValues(firstRow);
  if (O.isNone(columnNames)) {
    logger.debug('Failed to find column names');
    return O.none;
  }
  logger.trace('Found column names for sheet %o', columnNames.value);

  return O.some({
    columnIndexes: {
      timestamp: columnNames.value.findIndex(
        val => val.toLowerCase() === 'timestamp'
      ),
      email: columnNames.value.findIndex(val =>
        EMAIL_COLUMN_NAMES.includes(val.toLowerCase())
      ),
      score: columnNames.value.findIndex(val => val.toLowerCase() === 'score'),
      memberNumber: columnNames.value.findIndex(
        val => val.toLowerCase() === 'membership number'
      ),
    },
    columnNames: columnNames.value,
  });
};

const extractFromRow =
  (
    logger: Logger,
    sheetInfo: SheetInfo,
    equipmentId: UUID,
    trainingSheetId: string
  ) =>
  (row: sheets_v4.Schema$RowData): O.Option<QzEvent> => {
    if (!row.values) {
      return O.none;
    }

    const email =
      sheetInfo.columnIndexes.email >= 0
        ? extractEmail(row.values[sheetInfo.columnIndexes.email].formattedValue)
        : O.none;
    const memberNumber = extractMemberNumber(
      row.values[sheetInfo.columnIndexes.memberNumber].formattedValue
    );
    const score = extractScore(
      row.values[sheetInfo.columnIndexes.score].formattedValue
    );
    const timestampEpochS = extractTimestamp(
      row.values[sheetInfo.columnIndexes.timestamp].formattedValue
    );

    if (O.isNone(email) && O.isNone(memberNumber)) {
      // Note that some quizes only require the member number.
      logger.warn(
        'Failed to extract email or member number from row, skipping quiz result'
      );
      logger.trace('Skipped quiz row: %O', row.values);
      return O.none;
    }
    if (O.isNone(score)) {
      logger.warn('Failed to extract score from row, skipped row');
      logger.trace('Skipped quiz row: %o', row.values);
      return O.none;
    }
    if (O.isNone(timestampEpochS)) {
      logger.warn('Failed to extract timestamp from row, skipped row');
      logger.trace('Skipped quiz row: %o', row.values);
      return O.none;
    }

    const quizAnswers = RA.zip(sheetInfo.columnNames, row.values).reduce(
      (accum, [columnName, columnValue]) => {
        accum[columnName] = columnValue.formattedValue ?? null;
        return accum;
      },
      {} as Record<string, string | null>
    );

    return O.some(
      constructEvent('EquipmentTrainingQuizResult')({
        id: v4() as UUID,
        equipmentId,
        memberNumberProvided: O.isSome(memberNumber)
          ? memberNumber.value
          : null,
        emailProvided: O.isSome(email) ? email.value : null,
        trainingSheetId,
        timestampEpochS: timestampEpochS.value,
        ...score.value,
        quizAnswers: quizAnswers,
      })
    );
  };

export const extractGoogleSheetData =
  (logger: Logger, equipmentId: UUID, trainingSheetId: string) =>
  (
    spreadsheet: sheets_v4.Schema$Spreadsheet
  ): O.Option<ReadonlyArray<QzEvent>> => {
    logger.info('Processing google sheet data');
    // Initially
    // - Only handle a single sheet per-page.
    // - Assume the column names are the first row.
    if (!spreadsheet.sheets || spreadsheet.sheets.length < 1) {
      return O.none;
    }
    const sheet = spreadsheet.sheets[0];
    if (!sheet.data || sheet.data.length < 1) {
      return O.none;
    }

    const sheetData = sheet.data[0];
    if (!sheetData.rowData || sheetData.rowData.length < 1) {
      return O.none;
    }

    const sheetInfo = extractQuizSheetInformation(logger, sheetData.rowData[0]);

    if (O.isNone(sheetInfo)) {
      logger.warn(
        `Failed to extract sheet info '${trainingSheetId}' for equipment '${equipmentId}'`
      );
      return O.none;
    }

    return O.some(
      pipe(
        sheetData.rowData.slice(1),
        RA.map(
          extractFromRow(logger, sheetInfo.value, equipmentId, trainingSheetId)
        ),
        RA.filterMap(e => e)
      )
    );
  };
