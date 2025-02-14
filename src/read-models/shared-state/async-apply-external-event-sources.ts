import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {DomainEvent} from '../../types';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {EpochTimestampMilliseconds, MinimalEquipment} from './return-types';

import {EventOfType} from '../../types/domain-event';
import {GoogleHelpers} from '../../init-dependencies/google/pull_sheet_data';

import {getAllEquipmentMinimal} from './equipment/get';
import {expandLastQuizResult} from './equipment/expand';
import {Dependencies} from '../../dependencies';
import {
  extractGoogleSheetMetadata,
  GoogleSheetMetadata,
  MAX_COLUMN_INDEX,
} from '../../training-sheets/extract-metadata';
import {
  columnBoundsRequired,
  shouldPullFromSheet,
} from '../../training-sheets/google';
import {inspect} from 'node:util';
import {getChunkIndexes} from '../../util';

const ROW_BATCH_SIZE = 200;

export type EquipmentWithLastQuizResult = MinimalEquipment & {
  lastQuizResult: O.Option<EpochTimestampMilliseconds>;
};

const pullNewEquipmentQuizResultsForSheet = async (
  logger: Logger,
  googleHelpers: GoogleHelpers,
  equipment: EquipmentWithLastQuizResult,
  trainingSheetId: string,
  sheet: GoogleSheetMetadata,
  _timezone: string,
  _updateState: (event: EventOfType<'EquipmentTrainingQuizResult'>) => void
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
    logger.info('Pulled data from google');
    logger.info(inspect(data));
    await new Promise(res => setTimeout(res, 5000));
    // logger.info('About to extract google sheet data');
    // const result = extractGoogleSheetData(
    //   logger,
    //   trainingSheetId,
    //   equipment.id,
    //   sheet,
    //   timezone,
    //   equipment.lastQuizResult
    // )(data.right);
    // logger.info('Google sheet data extracted, result:');
    // logger.info(inspect(result));
    // logger.info('Updating data with the extracted data');
    // if (O.isSome(result)) {
    //   result.value.forEach(updateState);
    // }
  }
  logger.info('Finished processing sheet');
};

export const pullNewEquipmentQuizResults = async (
  logger: Logger,
  googleHelpers: GoogleHelpers,
  equipment: EquipmentWithLastQuizResult,
  updateState: (
    event:
      | EventOfType<'EquipmentTrainingQuizSync'>
      | EventOfType<'EquipmentTrainingQuizResult'>
  ) => void
): Promise<void> => {
  // TODO - Refactor this into fp-ts style.
  if (O.isNone(equipment.trainingSheetId)) {
    logger.warn(
      'No training sheet registered for equipment %s, skipping training data ingestion',
      equipment.name
    );
    // eslint-disable-next-line @typescript-eslint/require-await
    return;
  }
  const trainingSheetId = equipment.trainingSheetId.value;
  logger = logger.child({trainingSheetId});
  logger.info(
    'Scanning training sheet. Pulling google sheet data from %s...',
    equipment.lastQuizResult
  );

  const initialMeta = await googleHelpers.pullGoogleSheetDataMetadata(
    logger,
    trainingSheetId
  )();
  if (E.isLeft(initialMeta)) {
    logger.warn(initialMeta.left);
    return;
  }

  // Early return here - all is ok.

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

  logger.info('Sheets to pull');
  logger.info(inspect(sheets));

  for (const sheet of sheets) {
    await pullNewEquipmentQuizResultsForSheet(
      logger,
      googleHelpers,
      equipment,
      trainingSheetId,
      sheet,
      initialMeta.right.properties.timeZone,
      updateState
    );
  }

  // logger.info(
  //   'Finished pulling equipment quiz results for all sheets, generating quiz sync event...'
  // );

  // updateState(
  //   constructEvent('EquipmentTrainingQuizSync')({
  //     equipmentId: equipment.id,
  //   })
  // );
};

export const asyncApplyExternalEventSources = (
  logger: Logger,
  currentState: BetterSQLite3Database,
  googleHelpers: O.Option<GoogleHelpers>,
  updateState: (event: DomainEvent) => void,
  googleRateLimitMs: number,
  _cacheSheetData: Dependencies['cacheSheetData']
) => {
  return () => async () => {
    logger.info('Applying external event sources...');
    if (O.isNone(googleHelpers)) {
      logger.info('Google external event source disabled');
      return;
    }
    for (const equipment of getAllEquipmentMinimal(currentState)) {
      if (equipment.id === 'be613ddb-f959-4c07-9dab-a714c1d9dcfd') {
        logger.error('Skipping bambu equipment async apply completely');
        continue;
      }

      if (
        O.isSome(equipment.trainingSheetId) &&
        (O.isNone(equipment.lastQuizSync) ||
          (Date.now() as EpochTimestampMilliseconds) -
            equipment.lastQuizSync.value >
            googleRateLimitMs)
      ) {
        logger.info(
          'Triggering event update from google training sheets for %s...',
          equipment.name
        );
        // const events: (
        //   | EventOfType<'EquipmentTrainingQuizSync'>
        //   | EventOfType<'EquipmentTrainingQuizResult'>
        // )[] = [];
        // const collectEvents = (
        //   event:
        //     | EventOfType<'EquipmentTrainingQuizSync'>
        //     | EventOfType<'EquipmentTrainingQuizResult'>
        // ) => {
        //   logger.info('Collected event %o', event);
        //   events.push(event);
        //   // updateState(event);
        // };

        await pullNewEquipmentQuizResults(
          logger,
          googleHelpers.value,
          expandLastQuizResult(currentState)(equipment),
          updateState
        );
        logger.info(
          'Finished pulling events from google training sheet for %s, caching...',
          equipment.name
        );
        // const x = await cacheSheetData(
        //   new Date(),
        //   equipment.trainingSheetId.value,
        //   events
        // )();
        // if (E.isLeft(x)) {
        //   logger.error(
        //     'Failed to cache training sheet data for %s training sheet id %s, due to: %s',
        //     equipment.name,
        //     equipment.trainingSheetId,
        //     x.left.message
        //   );
        // }
      }
    }
    logger.info('Finished applying external event sources');
  };
};
