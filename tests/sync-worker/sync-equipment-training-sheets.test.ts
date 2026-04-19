import {GoogleHelpers} from '../../src/sync-worker/google/pull_sheet_data';
import {
  syncEquipmentTrainingSheets,
  SyncTrainingSheetDependencies,
} from '../../src/sync-worker/sync_training_sheet';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {Client, createClient} from '@libsql/client';
import {localGoogleHelpers as google} from '../init-dependencies/pull-local-google';
import {EventOfType} from '../../src/types/domain-event';
import {
  BAMBU,
  EMPTY,
  LASER_CUTTER,
  ManualParsedTrainingSheetEntry,
  METAL_LATHE,
} from '../data/google_sheet_data';
import {getRightOrFail, getSomeOrFail} from '../helpers';
import {ensureGoogleDBTablesExist} from '../../src/sync-worker/google/ensure-sheet-data-tables-exist';
import {ensureEventTableExists} from '../../src/init-dependencies/event-store/ensure-events-table-exists';
import {setTimeout} from 'node:timers/promises';
import {getSheetData} from '../../src/sync-worker/db/get_sheet_data';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {
  byTimestamp,
  createSyncTrainingSheetDependencies,
  expectSyncBetween,
  generateRegisterSheetEvent,
  pushEvents,
  testLogger,
} from './util';
import {GoogleDB, initGoogleDB} from '../../src/sync-worker/google/db';

const runSyncEquipmentTrainingSheets = async (
  deps: SyncTrainingSheetDependencies,
  google: GoogleHelpers,
  syncIntervalMs: number,
  eventDB: Client,
  events: ReadonlyArray<
    | EventOfType<'EquipmentTrainingSheetRegistered'>
    | EventOfType<'EquipmentTrainingSheetRemoved'>
  >
) => {
  await pushEvents(eventDB, deps.logger, events);
  await syncEquipmentTrainingSheets(deps, google, syncIntervalMs);
};

const getSheetDataSorted = async (googleDB: GoogleDB, sheetId: string) =>
  RA.sort(byTimestamp)(
    getRightOrFail(await getSheetData(googleDB)(sheetId, O.none)())
  );

const expectSheetDataMatches = async (
  googleDB: GoogleDB,
  sheetId: string,
  expectedData: ReadonlyArray<ManualParsedTrainingSheetEntry>
) => {
  const rows = await getSheetDataSorted(googleDB, sheetId);
  expect(rows).toHaveLength(expectedData.length);
  for (const [actual, expected] of RA.zip(RA.sort(byTimestamp)(expectedData))(
    rows
  )) {
    expect(actual.email_provided).toStrictEqual(expected.emailProvided);
    expect(actual.member_number_provided).toStrictEqual(
      expected.memberNumberProvided
    );
    expect(actual.score).toStrictEqual(expected.score);
    expect(actual.max_score).toStrictEqual(expected.maxScore);
    expect(actual.percentage).toStrictEqual(expected.percentage);
    expect(actual.response_submitted.getTime()).toStrictEqual(
      expected.timestampEpochMS
    );
  }
};

describe('Sync equipment training sheets', () => {
  let googleDBClient: Client;
  let googleDB: GoogleDB;
  let eventDB: Client;
  let deps: SyncTrainingSheetDependencies;
  const equipmentId = faker.string.uuid() as UUID;

  beforeEach(async () => {
    googleDBClient = createClient({url: ':memory:'});
    googleDB = initGoogleDB(googleDBClient);
    eventDB = createClient({url: ':memory:'});
    deps = createSyncTrainingSheetDependencies(googleDB, eventDB, testLogger());
    getRightOrFail(await ensureEventTableExists(eventDB)());
    await ensureGoogleDBTablesExist(googleDB)();
  });

  afterEach(() => {
    googleDBClient.close();
    eventDB.close();
  });

  describe('empty sheet', () => {
    const sheetId = EMPTY.apiResp.spreadsheetId!;
    const syncIntervalMs = 20_000;
    let startTime: Date, endTime: Date;
    beforeEach(async () => {
      startTime = new Date();
      await runSyncEquipmentTrainingSheets(
        deps,
        google,
        syncIntervalMs,
        eventDB,
        [generateRegisterSheetEvent(equipmentId, sheetId)]
      );
      endTime = new Date();
    });
    it('produces no rows', () =>
      expectSheetDataMatches(googleDB, sheetId, EMPTY.entries));
    it('sync recorded', () =>
      expectSyncBetween(deps, sheetId, startTime, O.some(endTime)));
    describe('re-sync run again within sync interval', () => {
      let beforeResync: Date;
      beforeEach(async () => {
        beforeResync = new Date();
        await runSyncEquipmentTrainingSheets(
          deps,
          google,
          syncIntervalMs,
          eventDB,
          [generateRegisterSheetEvent(equipmentId, sheetId)]
        );
      });

      it('no sync recorded', async () => {
        expect(
          getSomeOrFail(
            getRightOrFail(await deps.lastSync(sheetId)())
          ).getTime()
        ).toBeLessThanOrEqual(beforeResync.getTime());
      });
    });

    describe('re-sync run again after sync interval', () => {
      const syncIntervalMs = 1;
      let beforeResync: Date;
      beforeEach(async () => {
        await setTimeout(syncIntervalMs);
        beforeResync = new Date();
        await runSyncEquipmentTrainingSheets(
          deps,
          google,
          syncIntervalMs,
          eventDB,
          [generateRegisterSheetEvent(equipmentId, sheetId)]
        );
      });

      it('sync recorded', () =>
        expectSyncBetween(deps, sheetId, beforeResync, O.none));
    });
  });

  describe('metal lathe training sheet', () => {
    const sheetId = METAL_LATHE.apiResp.spreadsheetId!;
    const syncIntervalMs = 20_000;
    let startTime: Date, endTime: Date;
    beforeEach(async () => {
      startTime = new Date();
      await runSyncEquipmentTrainingSheets(
        deps,
        google,
        syncIntervalMs,
        eventDB,
        [generateRegisterSheetEvent(equipmentId, sheetId)]
      );
      endTime = new Date();
    });
    it('produces expected rows for a full sync', () =>
      expectSheetDataMatches(googleDB, sheetId, METAL_LATHE.entries));
    it('sync recorded', () =>
      expectSyncBetween(deps, sheetId, startTime, O.some(endTime)));
    describe('re-sync run again within sync interval', () => {
      let beforeResync: Date;
      beforeEach(async () => {
        beforeResync = new Date();
        await runSyncEquipmentTrainingSheets(
          deps,
          google,
          syncIntervalMs,
          eventDB,
          [generateRegisterSheetEvent(equipmentId, sheetId)]
        );
      });

      it('no sync recorded', async () => {
        expect(
          getSomeOrFail(
            getRightOrFail(await deps.lastSync(sheetId)())
          ).getTime()
        ).toBeLessThanOrEqual(beforeResync.getTime());
      });
    });

    describe('re-sync run again after sync interval', () => {
      const syncIntervalMs = 1;
      let beforeResync: Date;
      beforeEach(async () => {
        await setTimeout(syncIntervalMs);
        beforeResync = new Date();
        await runSyncEquipmentTrainingSheets(
          deps,
          google,
          syncIntervalMs,
          eventDB,
          [generateRegisterSheetEvent(equipmentId, sheetId)]
        );
      });

      it('sync recorded', () =>
        expectSyncBetween(deps, sheetId, beforeResync, O.none));
    });
  });

  describe('training sheet with a summary page', () => {
    const sheetId = LASER_CUTTER.apiResp.spreadsheetId!;
    const syncIntervalMs = 20_000;
    let startTime: Date, endTime: Date;
    beforeEach(async () => {
      startTime = new Date();
      await runSyncEquipmentTrainingSheets(
        deps,
        google,
        syncIntervalMs,
        eventDB,
        [generateRegisterSheetEvent(equipmentId, sheetId)]
      );
      endTime = new Date();
    });
    it('produces expected rows for a full sync', () =>
      expectSheetDataMatches(googleDB, sheetId, LASER_CUTTER.entries));
    it('sync recorded', () =>
      expectSyncBetween(deps, sheetId, startTime, O.some(endTime)));
  });

  describe('training sheet with multiple response pages (different quiz questions)', () => {
    const sheetId = BAMBU.apiResp.spreadsheetId!;
    const syncIntervalMs = 20_000;
    let startTime: Date, endTime: Date;
    beforeEach(async () => {
      startTime = new Date();
      await runSyncEquipmentTrainingSheets(
        deps,
        google,
        syncIntervalMs,
        eventDB,
        [generateRegisterSheetEvent(equipmentId, sheetId)]
      );
      endTime = new Date();
    });
    it('produces expected rows for a full sync', () =>
      expectSheetDataMatches(googleDB, sheetId, BAMBU.entries));
    it('sync recorded', () =>
      expectSyncBetween(deps, sheetId, startTime, O.some(endTime)));
  });
});
