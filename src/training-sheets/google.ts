import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';

import {Logger} from 'pino';
import {constructEvent} from '../types/domain-event';
import {sheets_v4} from 'googleapis';
import {v4} from 'uuid';
import {UUID} from 'io-ts-types';
import {DateTime} from 'luxon';
import {QzEvent, QzEventDuplicate} from './events';

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

export const extractGoogleSheetData =
  (
    logger: Logger,
    existingQuizResults: ReadonlyArray<QzEvent>,
    equipmentId: UUID,
    trainingSheetId: string
  ) =>
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
    const columnNames = extractRowFormattedValues(sheetData.rowData[0]);
    if (O.isNone(columnNames)) {
      logger.debug('Failed to find column names');
      return O.none;
    }
    logger.trace('Found column names for sheet %o', columnNames.value);

    const columnIndexes = {
      timestamp: columnNames.value.findIndex(
        val => val.toLowerCase() === 'timestamp'
      ),
      email: columnNames.value.findIndex(val => val.toLowerCase() === 'email'),
      score: columnNames.value.findIndex(val => val.toLowerCase() === 'score'),
    };

    const events = pipe(
      sheetData.rowData.slice(1),
      RA.map<sheets_v4.Schema$RowData, O.Option<QzEvent>>(row => {
        if (!row.values) {
          return O.none;
        }

        const email = extractEmail(
          row.values[columnIndexes.email].formattedValue
        );
        const score = extractScore(
          row.values[columnIndexes.score].formattedValue
        );
        const timestampEpochS = extractTimestamp(
          row.values[columnIndexes.timestamp].formattedValue
        );

        if (O.isNone(email)) {
          logger.warn(
            `Failed to extract email from '${
              row.values[columnIndexes.email].formattedValue
            }', skipped row`
          );
          return O.none;
        }
        if (O.isNone(score)) {
          logger.warn(
            `Failed to extract score from '${
              row.values[columnIndexes.score].formattedValue
            }', skipped row`
          );
          return O.none;
        }
        if (O.isNone(timestampEpochS)) {
          logger.warn(
            `Failed to extract timestamp from '${
              row.values[columnIndexes.score].formattedValue
            }', skipped row`
          );
          return O.none;
        }

        const quizAnswers = RA.zip(columnNames.value, row.values).reduce(
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
            email: email.value,
            trainingSheetId,
            timestampEpochS: timestampEpochS.value,
            ...score.value,
            quizAnswers: quizAnswers,
          })
        );
      }),
      RA.filterMap(e => e)
    );

    // We could check for duplicate quiz results earlier but I doubt the performance difference will be
    // measurable.
    logger.info(
      `Found ${events.length} quiz result events, checking for ones we have already seen...`
    );

    const newQuizResults =
      RA.difference(QzEventDuplicate)(existingQuizResults)(events);
    logger.info(`${newQuizResults.length} new quiz results after filtering`);
    return O.some(newQuizResults);
  };
