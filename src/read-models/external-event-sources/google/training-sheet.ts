import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {DomainEvent} from '../../../types';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';

import {constructEvent, EventOfType} from '../../../types/domain-event';
import {
  GoogleHelpers,
  GoogleSpreadsheetDataForSheet,
} from '../../../init-dependencies/google/pull_sheet_data';

import {Dependencies} from '../../../dependencies';
import {
  extractGoogleSheetMetadata,
  GoogleSheetMetadata,
  MAX_COLUMN_INDEX,
} from './extract-metadata';
import {getChunkIndexes} from '../../../util';
import {UUID} from 'io-ts-types';
import {formatValidationErrors} from 'io-ts-reporters';
import {pipe} from 'fp-ts/lib/function';
import {
  extractEmail,
  extractMemberNumber,
  extractScore,
  extractTimestamp,
} from './util';
import {startSpan} from '@sentry/node';
import {getLeastRecentlySyncedEquipment} from '../../shared-state/equipment/get';
import * as RA from 'fp-ts/ReadonlyArray';

import {v4} from 'uuid';
import {lookup} from 'fp-ts/ReadonlyArray';
import {array} from 'fp-ts';
import {LastGoogleSheetRowRead} from '../../shared-state/return-types';
import * as R from 'fp-ts/Record';

const ROW_BATCH_SIZE = 50;
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

type LastRowRead = number;

const pullNewEquipmentQuizResultsForSheet = async (
  logger: Logger,
  googleHelpers: GoogleHelpers,
  equipmentId: UUID,
  trainingSheetId: string,
  sheet: GoogleSheetMetadata,
  timezone: string,
  prevLastRowRead: O.Option<LastRowRead>,
  updateState: (event: EventOfType<'EquipmentTrainingQuizResult'>) => void
): Promise<LastRowRead> => {
  logger = logger.child({sheet_name: sheet.name});
  const startRow = O.getOrElse(() => 1)(prevLastRowRead) + 1;
  logger.info('Processing sheet, starting at row %s', startRow);
  for (const [rowStart, rowEnd] of getChunkIndexes(
    startRow, // 1-indexed and first row is headers.
    sheet.rowCount,
    ROW_BATCH_SIZE
  )) {
    logger.debug('Pulling data for sheet rows %s to %s', rowStart, rowEnd);

    const [minCol, maxCol] = columnBoundsRequired(sheet);

    const data = await googleHelpers.pullGoogleSheetData(
      logger,
      trainingSheetId,
      sheet.name,
      rowStart,
      rowEnd,
      minCol,
      maxCol
    )();
    if (E.isLeft(data)) {
      logger.error(
        data.left,
        'Failed to pull data for sheet rows %s to %s, skipping rest of sheet',
        rowStart,
        rowEnd
      );
      return rowStart - 1;
    }
    logger.info('Pulled data from google, extracting...');
    const result = extractGoogleSheetData(
      logger,
      trainingSheetId,
      equipmentId,
      sheet,
      timezone
    )(data.right);
    logger.info(
      'Google sheet data extracted, updating data with the extracted data...'
    );
    if (O.isSome(result)) {
      result.value.forEach(updateState);
    }
  }
  logger.info('Finished processing sheet');
  return sheet.rowCount - 1;
};

export const pullNewEquipmentQuizResults = async (
  logger: Logger,
  googleHelpers: GoogleHelpers,
  equipmentId: UUID,
  trainingSheetId: string,
  prevLastRowRead: Readonly<LastGoogleSheetRowRead>,
  updateState: (
    event:
      | EventOfType<'EquipmentTrainingQuizSync'>
      | EventOfType<'EquipmentTrainingQuizResult'>
  ) => void
): Promise<void> => {
  logger.info('Scanning training sheet. Pulling google sheet data...');

  const initialMeta = await googleHelpers.pullGoogleSheetDataMetadata(
    logger,
    trainingSheetId
  )();
  if (E.isLeft(initialMeta)) {
    logger.warn(initialMeta.left);
    return;
  }

  logger.info('Got meta data for sheet...');

  const sheets: GoogleSheetMetadata[] = [];
  for (const sheet of initialMeta.right.sheets) {
    if (!shouldPullFromSheet(trainingSheetId, sheet)) {
      logger.warn(
        "Skipping sheet '%s' as doesn't match expected for form responses",
        sheet.properties.title
      );
      continue;
    }

    const firstRowData = await googleHelpers.pullGoogleSheetData(
      logger,
      trainingSheetId,
      sheet.properties.title,
      1,
      1,
      0,
      MAX_COLUMN_INDEX
    )();
    if (E.isLeft(firstRowData)) {
      logger.warn(
        'Failed to get google sheet first row data for sheet %s, skipping',
        sheet.properties.title
      );
      continue;
    }

    const meta = extractGoogleSheetMetadata(logger)(sheet, firstRowData.right);
    if (O.isNone(meta)) {
      continue;
    }

    logger.info(
      'Got metadata for sheet: %s: %o',
      sheet.properties.title,
      meta.value
    );
    sheets.push(meta.value);
  }

  const newLastRowRead: LastGoogleSheetRowRead = JSON.parse(
    JSON.stringify(prevLastRowRead)
  ) as LastGoogleSheetRowRead;

  for (const sheet of sheets) {
    const prevLastRowReadForSheet = pipe(
      prevLastRowRead,
      R.lookup(trainingSheetId),
      O.flatMap(R.lookup(sheet.name))
    );
    const lastRowRead = await pullNewEquipmentQuizResultsForSheet(
      logger,
      googleHelpers,
      equipmentId,
      trainingSheetId,
      sheet,
      initialMeta.right.properties.timeZone,
      prevLastRowReadForSheet,
      updateState
    );
    if (!newLastRowRead[trainingSheetId]) {
      newLastRowRead[trainingSheetId] = {};
    }
    newLastRowRead[trainingSheetId][sheet.name] = lastRowRead;
  }

  logger.info(
    'Finished pulling equipment quiz results for all sheets %o, generating quiz sync event...',
    newLastRowRead
  );

  updateState(
    constructEvent('EquipmentTrainingQuizSync')({
      equipmentId,
      lastRowsRead: newLastRowRead,
    })
  );
};

export async function asyncApplyTrainingSheetEvents(
  logger: Logger,
  currentState: BetterSQLite3Database,
  googleHelpers: GoogleHelpers,
  updateState: (event: DomainEvent) => void,
  googleRefreshIntervalMs: number,
  cacheSheetData: Dependencies['cacheSheetData']
) {
  logger.info(
    'Pulling google training sheet data for least recently synced equipment'
  );
  // Temporarily try syncing just 1 piece of equipment at a time
  for (const equipment of getLeastRecentlySyncedEquipment(currentState, 1)) {
    const equipmentLogger = logger.child({equipment});
    if (
      O.isNone(equipment.trainingSheetId) ||
      (O.isSome(equipment.lastQuizSync) &&
        Date.now() - equipment.lastQuizSync.value < googleRefreshIntervalMs)
    ) {
      equipmentLogger.info('No google training sheet refresh required');
      continue;
    }
    const equipmentTrainingSheetId = equipment.trainingSheetId.value;
    await startSpan(
      {
        name: 'Async Apply Google Events Equipment',
        attributes: {
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          equipment_training_sheet_id: equipmentTrainingSheetId,
        },
      },
      async () => {
        equipmentLogger.info(
          'Triggering event update from google training sheets...'
        );

        const events: (
          | EventOfType<'EquipmentTrainingQuizSync'>
          | EventOfType<'EquipmentTrainingQuizResult'>
        )[] = [];
        const collectEvents = (
          event:
            | EventOfType<'EquipmentTrainingQuizSync'>
            | EventOfType<'EquipmentTrainingQuizResult'>
        ) => {
          events.push(event);
          updateState(event);
        };

        await pullNewEquipmentQuizResults(
          equipmentLogger,
          googleHelpers,
          equipment.id,
          equipmentTrainingSheetId,
          equipment.lastRowsRead,
          collectEvents
        );
        equipmentLogger.info(
          'Finished pulling %s events from google training sheet, caching...',
          events.length
        );
        await cacheSheetData(
          new Date(),
          equipmentTrainingSheetId,
          equipmentLogger,
          events
        );
      }
    );
  }
  logger.info('Finished pulling google training sheet data');
}
