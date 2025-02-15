import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {DomainEvent} from '../../types';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';

import {constructEvent, EventOfType} from '../../types/domain-event';
import {GoogleHelpers} from '../../init-dependencies/google/pull_sheet_data';

import {getAllEquipmentMinimal} from './equipment/get';
import {Dependencies} from '../../dependencies';
import {
  extractGoogleSheetMetadata,
  GoogleSheetMetadata,
  MAX_COLUMN_INDEX,
} from '../../training-sheets/extract-metadata';
import {
  columnBoundsRequired,
  extractGoogleSheetData,
  shouldPullFromSheet,
} from '../../training-sheets/google';
import {getChunkIndexes} from '../../util';
import {UUID} from 'io-ts-types';

const ROW_BATCH_SIZE = 200;

const pullNewEquipmentQuizResultsForSheet = async (
  logger: Logger,
  googleHelpers: GoogleHelpers,
  equipmentId: UUID,
  trainingSheetId: string,
  sheet: GoogleSheetMetadata,
  timezone: string,
  updateState: (event: EventOfType<'EquipmentTrainingQuizResult'>) => void
): Promise<void> => {
  logger = logger.child({sheet_name: sheet.name});
  logger.info('Processing sheet');
  for (const [rowStart, rowEnd] of getChunkIndexes(
    2, // 1-indexed and first row is headers.
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
      return;
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
};

export const pullNewEquipmentQuizResults = async (
  logger: Logger,
  googleHelpers: GoogleHelpers,
  equipmentId: UUID,
  trainingSheetId: string,
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
    if (!shouldPullFromSheet(sheet)) {
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

  for (const sheet of sheets) {
    await pullNewEquipmentQuizResultsForSheet(
      logger,
      googleHelpers,
      equipmentId,
      trainingSheetId,
      sheet,
      initialMeta.right.properties.timeZone,
      updateState
    );
  }

  logger.info(
    'Finished pulling equipment quiz results for all sheets, generating quiz sync event...'
  );

  updateState(
    constructEvent('EquipmentTrainingQuizSync')({
      equipmentId,
    })
  );
};

export const asyncApplyExternalEventSources = (
  logger: Logger,
  currentState: BetterSQLite3Database,
  googleHelpers: O.Option<GoogleHelpers>,
  updateState: (event: DomainEvent) => void,
  googleRefreshIntervalMs: number,
  cacheSheetData: Dependencies['cacheSheetData']
) => {
  return () => async () => {
    logger.info('Applying external event sources...');
    if (O.isNone(googleHelpers)) {
      logger.info('Google external event source disabled');
      return;
    }
    for (const equipment of getAllEquipmentMinimal(currentState)) {
      const equipmentLogger = logger.child({equipment});
      if (
        O.isNone(equipment.trainingSheetId) ||
        (O.isSome(equipment.lastQuizSync) &&
          Date.now() - equipment.lastQuizSync.value < googleRefreshIntervalMs)
      ) {
        equipmentLogger.info('No google training sheet refresh required');
        continue;
      }

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
        googleHelpers.value,
        equipment.id,
        equipment.trainingSheetId.value,
        collectEvents
      );
      equipmentLogger.info(
        'Finished pulling %s events from google training sheet, caching...',
        events.length
      );
      await new Promise(res => setTimeout(res, 7500));
      const x = await cacheSheetData(
        new Date(),
        equipment.trainingSheetId.value,
        equipmentLogger,
        events
      )();
      if (E.isLeft(x)) {
        equipmentLogger.error(
          'Failed to cache training sheet data due to: %s',
          x.left.message
        );
      }
    }
    logger.info('Finished applying external event sources');
  };
};
