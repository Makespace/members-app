import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';

import {Logger} from 'pino';
import {constructEvent} from '../types/domain-event';
import {v4} from 'uuid';
import {UUID} from 'io-ts-types';
import {DateTime} from 'luxon';
import {QzEvent} from '../types/qz-event';
import {sheets_v4} from '@googleapis/sheets';

// Bounds to prevent clearly broken parsing.
const MIN_RECOGNISED_MEMBER_NUMBER = 0;
const MAX_RECOGNISED_MEMBER_NUMBER = 1_000_000;

const MIN_VALID_TIMESTAMP_EPOCH_S = 1262304000; // Year 2010
const MAX_VALID_TIMESTAMP_EPOCH_S = 4102444800; // Year 2100

const FORM_RESPONSES_SHEET_REGEX = /^Form Responses [0-9]*/i;

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
  timezone: string,
  rowValue: string | undefined | null
): O.Option<number> => {
  if (!rowValue) {
    return O.none;
  }
  try {
    const timestampEpochS = DateTime.fromFormat(
      rowValue,
      'dd/MM/yyyy HH:mm:ss',
      {
        setZone: true,
        zone: timezone,
      }
    ).toUnixInteger();
    if (
      isNaN(timestampEpochS) ||
      !isFinite(timestampEpochS) ||
      timestampEpochS < MIN_VALID_TIMESTAMP_EPOCH_S ||
      timestampEpochS > MAX_VALID_TIMESTAMP_EPOCH_S
    ) {
      return O.none;
    }
    return O.some(timestampEpochS);
  } catch {
    return O.none;
  }
};

const EMAIL_COLUMN_NAMES = ['email address', 'email'];

type SheetInfo = {
  columnIndexes: {
    timestamp: O.Option<number>;
    email: O.Option<number>;
    score: O.Option<number>;
    memberNumber: O.Option<number>;
  };
  columnNames: string[];
};

const extractQuizSheetInformation =
  (logger: Logger) =>
  (firstRow: sheets_v4.Schema$RowData): O.Option<SheetInfo> => {
    const columnNames = extractRowFormattedValues(firstRow);
    if (O.isNone(columnNames)) {
      logger.debug('Failed to find column names');
      return O.none;
    }
    logger.trace('Found column names for sheet %o', columnNames.value);

    return O.some({
      columnIndexes: {
        timestamp: RA.findIndex<string>(
          val => val.toLowerCase() === 'timestamp'
        )(columnNames.value),
        email: RA.findIndex<string>(val =>
          EMAIL_COLUMN_NAMES.includes(val.toLowerCase())
        )(columnNames.value),
        score: RA.findIndex<string>(val => val.toLowerCase() === 'score')(
          columnNames.value
        ),
        memberNumber: RA.findIndex<string>(
          val => val.toLowerCase() === 'membership number'
        )(columnNames.value),
      },
      columnNames: columnNames.value,
    });
  };

const extractFromRow =
  (
    logger: Logger,
    sheetInfo: SheetInfo,
    equipmentId: UUID,
    trainingSheetId: string,
    timezone: string
  ) =>
  (row: sheets_v4.Schema$RowData): O.Option<QzEvent> => {
    if (!row.values) {
      return O.none;
    }

    const email = O.isSome(sheetInfo.columnIndexes.email)
      ? extractEmail(
          row.values[sheetInfo.columnIndexes.email.value].formattedValue
        )
      : O.none;
    const memberNumber = O.isSome(sheetInfo.columnIndexes.memberNumber)
      ? extractMemberNumber(
          row.values[sheetInfo.columnIndexes.memberNumber.value].formattedValue
        )
      : O.none;
    const score = O.isSome(sheetInfo.columnIndexes.score)
      ? extractScore(
          row.values[sheetInfo.columnIndexes.score.value].formattedValue
        )
      : O.none;
    const timestampEpochS = O.isSome(sheetInfo.columnIndexes.timestamp)
      ? extractTimestamp(
          timezone,
          row.values[sheetInfo.columnIndexes.timestamp.value].formattedValue
        )
      : O.none;

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
        accum[columnName] = columnValue?.formattedValue ?? '';
        return accum;
      },
      {} as Record<string, string>
    );

    if (timestampEpochS.value === null) {
      console.log('FOUND NULL TIMESTAMP VALUE');
      console.log(quizAnswers);
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
  ): ReadonlyArray<ReadonlyArray<QzEvent>> =>
    !spreadsheet.sheets || spreadsheet.sheets.length < 1
      ? []
      : spreadsheet.sheets.map(sheet => {
          const title = sheet.properties?.title;
          if (!title) {
            logger.warn('Skipping sheet due to missing title');
            return [];
          }
          if (!FORM_RESPONSES_SHEET_REGEX.test(title)) {
            logger.warn(
              `Skipping sheet '${title}' as title doesn't match expected for form responses`
            );
          }

          if (
            !sheet.data ||
            sheet.data.length < 1 ||
            !sheet.data[0].rowData ||
            sheet.data[0].rowData.length < 1
          ) {
            logger.warn(`Skipping sheet '${title}' as missing data`);
            return [];
          }

          let timezone = spreadsheet.properties?.timeZone;
          if (!timezone || !DateTime.local().setZone(timezone).isValid) {
            // Not all the google form sheets are actually in Europe/London.
            // Issue first noticed because CI is in a different zone (UTC) than local test machine (BST).
            logger.info(
              `Unable to determine timezone for google sheet '${spreadsheet.properties?.title}', '${timezone}' - defaulting to Europe/London`
            );
            timezone = 'Europe/London';
          }

          const [headers, ...data] = sheet.data[0].rowData;

          return pipe(
            headers,
            extractQuizSheetInformation(logger),
            O.match(
              () => {
                logger.warn(
                  `Failed to extract sheet info '${trainingSheetId}' for equipment '${equipmentId}'`
                );
                return [];
              },
              sheetInfo =>
                pipe(
                  data,
                  RA.map(
                    extractFromRow(
                      logger,
                      sheetInfo,
                      equipmentId,
                      trainingSheetId,
                      timezone
                    )
                  ),
                  RA.filterMap(e => e)
                )
            )
          );
        });
