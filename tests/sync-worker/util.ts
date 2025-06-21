import {UUID} from 'io-ts-types/lib/UUID';
import {constructEvent} from '../../src/types';
import {EventOfType} from '../../src/types/domain-event';
import pino, {Logger} from 'pino';
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
import {commitEvent} from '../../src/init-dependencies/event-store/commit-event';

export const generateRegisterSheetEvent = (
  equipmentId: UUID,
  trainingSheetId: string
): EventOfType<'EquipmentTrainingSheetRegistered'> =>
  constructEvent('EquipmentTrainingSheetRegistered')({
    equipmentId,
    trainingSheetId,
  });

export const generateRemoveSheetEvent = (
  equipmentId: UUID
): EventOfType<'EquipmentTrainingSheetRemoved'> =>
  constructEvent('EquipmentTrainingSheetRemoved')({
    equipmentId,
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

export const pushEvents = async (
  db: Client,
  logger: Logger,
  events: ReadonlyArray<
    | EventOfType<'EquipmentTrainingSheetRegistered'>
    | EventOfType<'EquipmentTrainingSheetRemoved'>
  >
) => {
  if (events.length === 0) {
    return;
  }
  await commitEvent(db, logger, () => async () => {})(
    {
      type: 'equipment',
      id: '0', // For the purpose of these tests we can just use the same 'equipment' for concurrency control.
    },
    'no-such-resource'
  )(events[0])();
  let resourceVersion = 1;
  for (const event of events.slice(1)) {
    await commitEvent(db, logger, () => async () => {})(
      {
        type: 'equipment',
        id: '0',
      },
      resourceVersion
    )(event)();
    resourceVersion++;
  }
};
