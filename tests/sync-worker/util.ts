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
import {
  ManualParsedTrainingSheetEntry,
  ManualParsedTroubleTicketEntry,
} from '../data/google_sheet_data';
import {
  SheetDataTable,
  TroubleTicketDataTable,
} from '../../src/sync-worker/google/sheet-data-table';
import {commitEvent} from '../../src/init-dependencies/event-store/commit-event';
import {getResourceEvents} from '../../src/init-dependencies/event-store/get-resource-events';
import {Resource} from '../../src/types/resource';
import {getRightOrFail, getSomeOrFail} from '../helpers';
import {SyncTroubleTicketDependencies} from '../../src/sync-worker/sync_trouble_ticket';
import {storeTroubleTicketRowsRead} from '../../src/sync-worker/db/store_trouble_ticket_rows_read';
import {lastTroubleTicketRowRead} from '../../src/sync-worker/db/last_trouble_ticket_row_read';
import * as O from 'fp-ts/Option';
import {SyncWorkerDependencies} from '../../src/sync-worker/dependencies';

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
    level: 'fatal',
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

export const createSyncTroubleTicketDependencies = (
  db: Client
): SyncTroubleTicketDependencies => ({
  logger: testLogger(),
  storeSync: storeSync(db),
  lastSync: lastSync(db),
  storeTroubleTicketRowsRead: storeTroubleTicketRowsRead(db),
  lastTroubleTicketRowRead: lastTroubleTicketRowRead(db),
});

export const byTimestamp = pipe(
  N.Ord,
  contramap(
    (
      d:
        | ManualParsedTrainingSheetEntry
        | ManualParsedTroubleTicketEntry
        | SheetDataTable['rows'][0]
        | TroubleTicketDataTable['rows'][0]
    ) =>
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
  const resource: Resource = {
    type: 'equipment',
    id: '0', // For the purpose of these tests we can just use the same 'equipment' for concurrency control.
  };
  for (const event of events) {
    await commitEvent(db, logger, () => async () => {})(
      resource,
      getRightOrFail(await getResourceEvents(db)(resource)()).version
    )(event)();
  }
};

export const expectSyncBetween = async (
  deps: Pick<SyncWorkerDependencies, 'lastSync'>,
  sheetId: string,
  startInclusive: Date,
  endInclusive: O.Option<Date>
) => {
  const lastSync = getSomeOrFail(
    getRightOrFail(await deps.lastSync(sheetId)())
  );
  expect(lastSync.getTime()).toBeGreaterThanOrEqual(startInclusive.getTime());
  if (O.isSome(endInclusive)) {
    expect(lastSync.getTime()).toBeLessThanOrEqual(
      endInclusive.value.getTime()
    );
  }
};
