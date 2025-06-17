import pino, {Logger} from 'pino';
import {GoogleHelpers} from '../../src/sync-worker/google/pull_sheet_data';
import {
  syncEquipmentTrainingSheets,
  SyncTrainingSheetDependencies,
} from '../../src/sync-worker/sync_training_sheet';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {Client, createClient} from '@libsql/client/.';
import {storeSync} from '../../src/sync-worker/db/store_sync';
import {lastSync} from '../../src/sync-worker/db/last_sync';
import {getTrainingSheetsToSync} from '../../src/sync-worker/db/get_training_sheets_to_sync';
import {storeTrainingSheetRowsRead} from '../../src/sync-worker/db/store_training_sheet_rows_read';
import {lastTrainingSheetRowRead} from '../../src/sync-worker/db/last_training_sheet_row_read';
import {localGoogleHelpers as google} from '../init-dependencies/pull-local-google';
import {constructEvent, EventOfType} from '../../src/types/domain-event';
import {EMPTY} from '../data/google_sheet_data';
import {getSheetData} from '../../src/sync-worker/db/get_sheet_data';
import {getRightOrFail, getSomeOrFail} from '../helpers';
import {commitEvent} from '../../src/init-dependencies/event-store/commit-event';
import {setTimeout} from 'node:timers/promises';

const pushEvents = (
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
  commitEvent(db, logger, () => async () => {})(
    {
      type: 'equipment',
      id: '0', // For the purpose of these tests we can just use the same 'equipment' for concurrency control.
    },
    'no-such-resource'
  )(events[0]);
  let resourceVersion = 1;
  for (const event of events.slice(1)) {
    commitEvent(db, logger, () => async () => {})(
      {
        type: 'equipment',
        id: '0',
      },
      resourceVersion
    )(event);
    resourceVersion++;
  }
};

const runSyncEquipmentTrainingSheets = async (
  deps: SyncTrainingSheetDependencies,
  google: GoogleHelpers,
  syncIntervalMs: number,
  db: Client,
  events: ReadonlyArray<
    | EventOfType<'EquipmentTrainingSheetRegistered'>
    | EventOfType<'EquipmentTrainingSheetRemoved'>
  >
) => {
  pushEvents(db, deps.logger, events);
  await syncEquipmentTrainingSheets(deps, google, syncIntervalMs);
};

const generateRegisterEvent = (
  equipmentId: UUID,
  trainingSheetId: string
): EventOfType<'EquipmentTrainingSheetRegistered'> =>
  constructEvent('EquipmentTrainingSheetRegistered')({
    equipmentId,
    trainingSheetId,
  });

const testLogger = () =>
  pino({
    level: 'fatal',
    timestamp: pino.stdTimeFunctions.isoTime,
  });

const createSyncTrainingSheetDependencies = (
  db: Client
): SyncTrainingSheetDependencies => ({
  logger: testLogger(),
  getTrainingSheetsToSync: getTrainingSheetsToSync(db),
  storeSync: storeSync(db),
  lastSync: lastSync(db),
  storeTrainingSheetRowsRead: storeTrainingSheetRowsRead(db),
  lastTrainingSheetRowRead: lastTrainingSheetRowRead(db),
});

describe('Sync equipment training sheets', () => {
  let db: Client;
  let deps: SyncTrainingSheetDependencies;
  const equipmentId = faker.string.uuid() as UUID;

  beforeEach(() => {
    db = createClient({url: ':memory:'});
    deps = createSyncTrainingSheetDependencies(db);
  });

  describe('empty sheet', () => {
    const sheetId = EMPTY.apiResp.spreadsheetId!;
    let syncIntervalMs = 20_000;
    let startTime: number, endTime: number;
    beforeEach(async () => {
      startTime = Date.now();
      await runSyncEquipmentTrainingSheets(deps, google, syncIntervalMs, db, [
        generateRegisterEvent(equipmentId, sheetId),
      ]);
      endTime = Date.now();
    });
    it('produces no rows', async () => {
      const rows = getRightOrFail(await getSheetData(db)(sheetId, [], [])());
      expect(rows).toHaveLength(0);
    });
    it('sync recorded', async () => {
      const lastSync = getSomeOrFail(
        getRightOrFail(await deps.lastSync(sheetId)())
      );
      expect(lastSync.getTime()).toBeGreaterThanOrEqual(startTime);
      expect(lastSync.getTime()).toBeLessThanOrEqual(endTime);
    });
    it('last training sheet row read is 0', async () => {
      expect(
        getRightOrFail(await deps.lastTrainingSheetRowRead(sheetId)())
      ).toStrictEqual({
        [EMPTY.metadata.sheets[0].properties.title]: 0,
      });
    });
    describe('re-sync run again within sync interval', () => {
      let beforeResync: number;
      beforeEach(async () => {
        beforeResync = Date.now();
        await runSyncEquipmentTrainingSheets(deps, google, syncIntervalMs, db, [
          generateRegisterEvent(equipmentId, sheetId),
        ]);
      });

      it('no sync recorded', async () => {
        expect(
          getSomeOrFail(getRightOrFail(await deps.lastSync(sheetId)()))
        ).toBeLessThanOrEqual(beforeResync);
      });
    });

    describe('re-sync run again after sync interval', () => {
      syncIntervalMs = 1;
      let beforeResync: number;
      beforeEach(async () => {
        await setTimeout(syncIntervalMs);
        beforeResync = Date.now();
        await runSyncEquipmentTrainingSheets(deps, google, syncIntervalMs, db, [
          generateRegisterEvent(equipmentId, sheetId),
        ]);
      });

      it('sync recorded', async () => {
        expect(
          getSomeOrFail(getRightOrFail(await deps.lastSync(sheetId)()))
        ).toBeGreaterThanOrEqual(beforeResync);
      });
    });
  });
});
