import {UUID} from 'io-ts-types/lib/UUID';
import {constructEvent} from '../../src/types';
import {EventOfType} from '../../src/types/domain-event';
import pino from 'pino';
import {SyncTrainingSheetDependencies} from '../../src/sync-worker/sync_training_sheet';
import {Client} from '@libsql/client';
import {getTrainingSheetsToSync} from '../../src/sync-worker/db/get_training_sheets_to_sync';
import {storeSync} from '../../src/sync-worker/db/store_sync';
import {lastSync} from '../../src/sync-worker/db/last_sync';
import {storeTrainingSheetRowsRead} from '../../src/sync-worker/db/store_training_sheet_rows_read';
import {lastTrainingSheetRowRead} from '../../src/sync-worker/db/last_training_sheet_row_read';
import {pipe} from 'fp-ts/lib/function';
import * as N from 'fp-ts/number';
import {contramap} from 'fp-ts/lib/Ord';
import {ManualParsedTrainingSheetEntry} from '../data/google_sheet_data';
import {SheetDataTable} from '../../src/sync-worker/google/sheet-data-table';

export const generateRegisterEvent = (
  equipmentId: UUID,
  trainingSheetId: string
): EventOfType<'EquipmentTrainingSheetRegistered'> =>
  constructEvent('EquipmentTrainingSheetRegistered')({
    equipmentId,
    trainingSheetId,
  });

export const testLogger = () =>
  pino({
    level: 'debug',
    timestamp: pino.stdTimeFunctions.isoTime,
  });

export const createSyncTrainingSheetDependencies = (
  db: Client
): SyncTrainingSheetDependencies => ({
  logger: testLogger(),
  getTrainingSheetsToSync: getTrainingSheetsToSync(db),
  storeSync: storeSync(db),
  lastSync: lastSync(db),
  storeTrainingSheetRowsRead: storeTrainingSheetRowsRead(db),
  lastTrainingSheetRowRead: lastTrainingSheetRowRead(db),
});

export const byTimestamp = pipe(
  N.Ord,
  contramap((d: ManualParsedTrainingSheetEntry | SheetDataTable['rows'][0]) =>
    'response_submitted' in d
      ? d.response_submitted.getTime()
      : d.timestampEpochMS
  )
);
