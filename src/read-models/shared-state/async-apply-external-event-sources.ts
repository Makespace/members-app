import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {DomainEvent} from '../../types';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {getAllEquipment} from './get-equipment';
import {pipe} from 'fp-ts/lib/function';
import {EpochTimestampMilliseconds, Equipment} from './return-types';
import {
  extractGoogleSheetData,
  shouldPullFromSheet,
} from '../../training-sheets/google';
import {constructEvent} from '../../types/domain-event';
import {GoogleHelpers} from '../../init-dependencies/google/pull_sheet_data';
import {
  extractGoogleSheetMetadata,
  extractInitialGoogleSheetMetadata,
  GoogleSheetMetadata,
  MAX_COLUMN_INDEX,
} from '../../training-sheets/extract-metadata';
import {getChunkIndexes} from '../../util';

const ROW_BATCH_SIZE = 500;

export const pullNewEquipmentQuizResultsForSheet = async (
  logger: Logger,
  googleHelpers: GoogleHelpers,
  equipment: Equipment,
  trainingSheetId: string,
  sheet: GoogleSheetMetadata,
  updateState: (event: DomainEvent) => void
) => {
  logger.info('Processing sheet %s', sheet.name);
  for (const [rowStart, rowEnd] of getChunkIndexes(
    2,
    sheet.rowCount,
    ROW_BATCH_SIZE
  )) {
    logger.debug(
      'Pulling data for sheet %s rows %s to %s',
      sheet.name,
      rowStart,
      rowEnd
    );
    const data = await googleHelpers.pullGoogleSheetData(
      logger,
      trainingSheetId,
      sheet.name,
      rowStart,
      rowEnd,
      Math.min(...Object.values(sheet.requiredColumns)),
      Math.max(...Object.values(sheet.requiredColumns))
    )();
    if (E.isLeft(data)) {
      logger.debug(
        'Failed to pull data for sheet %s rows %s to %s, skipping rest of sheet'
      );
      return;
    }
    pipe(
      data.right,
      extractGoogleSheetData(
        logger,
        trainingSheetId,
        equipment.id,
        equipment.lastQuizResult
      ),
      RA.map(updateState)
    );
  }
};

export const pullNewEquipmentQuizResults = async (
  logger: Logger,
  googleHelpers: GoogleHelpers,
  equipment: Equipment,
  updateState: (event: DomainEvent) => void
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

  const initialRaw = await googleHelpers.pullGoogleSheetDataMetadata(
    logger,
    trainingSheetId
  )();
  if (E.isLeft(initialRaw)) {
    logger.warn(initialRaw.left);
    return;
  }

  const initialMeta = extractInitialGoogleSheetMetadata(initialRaw.right);

  if (E.isLeft(initialMeta)) {
    logger.warn(
      'Failed to get google sheet metadata for training sheet %s, skipping',
      trainingSheetId
    );
    logger.warn(initialMeta.left);
    return;
  }

  const sheets: GoogleSheetMetadata[] = [];
  for (const sheet of initialMeta.right.sheets) {
    if (!shouldPullFromSheet(sheet)) {
      logger.warn(
        "Skipping sheet as doesn't match expected for form responses"
      );
      continue;
    }

    const firstRowData = await googleHelpers.pullGoogleSheetData(
      logger,
      trainingSheetId,
      sheet.name,
      1,
      1,
      0,
      MAX_COLUMN_INDEX
    )();
    if (E.isLeft(firstRowData)) {
      logger.warn(
        'Failed to get google sheet first row data for sheet %s, skipping',
        sheet.name
      );
      continue;
    }

    const meta = extractGoogleSheetMetadata(logger)(sheet, firstRowData.right);
    if (O.isNone(meta)) {
      continue;
    }

    logger.info('Got metadata for sheet: %s: %o', sheet.name, meta.value);
    sheets.push(meta.value);
  }

  for (const sheet of sheets) {
    await pullNewEquipmentQuizResultsForSheet(
      logger,
      googleHelpers,
      equipment,
      trainingSheetId,
      sheet,
      updateState
    );
  }

  updateState(
    constructEvent('EquipmentTrainingQuizSync')({
      equipmentId: equipment.id,
    })
  );
};

export const asyncApplyExternalEventSources = (
  logger: Logger,
  currentState: BetterSQLite3Database,
  googleHelpers: O.Option<GoogleHelpers>,
  updateState: (event: DomainEvent) => void,
  googleRateLimitMs: number
) => {
  return () => async () => {
    logger.info('Applying external event sources...');
    if (O.isNone(googleHelpers)) {
      logger.info('Google external event source disabled');
      return;
    }
    for (const equipment of getAllEquipment(currentState)()) {
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
        await pullNewEquipmentQuizResults(
          logger,
          googleHelpers.value,
          equipment,
          updateState
        );
        logger.info(
          'Finished pulling events from google training sheet for %s',
          equipment.name
        );
      }
    }
    logger.info('Finished applying external event sources');
  };
};
