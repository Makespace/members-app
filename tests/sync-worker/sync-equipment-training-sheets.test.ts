import {Logger} from 'pino';
import {GoogleHelpers} from '../../src/sync-worker/google/pull_sheet_data';
import {
  syncEquipmentTrainingSheets,
  SyncTrainingSheetDependencies,
} from '../../src/sync-worker/sync_training_sheet';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {Client, createClient} from '@libsql/client/.';
import {localGoogleHelpers as google} from '../init-dependencies/pull-local-google';
import {EventOfType} from '../../src/types/domain-event';
import {
  EMPTY,
  ManualParsedTrainingSheetEntry,
  METAL_LATHE,
} from '../data/google_sheet_data';
import {getRightOrFail, getSomeOrFail} from '../helpers';
import {commitEvent} from '../../src/init-dependencies/event-store/commit-event';
import {ensureDBTablesExist} from '../../src/sync-worker/google/ensure-sheet-data-tables-exist';
import {ensureEventTableExists} from '../../src/init-dependencies/event-store/ensure-events-table-exists';
import {setTimeout} from 'node:timers/promises';
import {getSheetData} from '../../src/sync-worker/db/get_sheet_data';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {
  byTimestamp,
  createSyncTrainingSheetDependencies,
  generateRegisterEvent,
} from './util';

const pushEvents = async (
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
  await pushEvents(db, deps.logger, events);
  await syncEquipmentTrainingSheets(deps, google, syncIntervalMs);
};

const getSheetDataSorted = async (db: Client, sheetId: string) =>
  RA.sort(byTimestamp)(getRightOrFail(await getSheetData(db)(sheetId)()));

const expectSheetDataMatches = async (
  db: Client,
  sheetId: string,
  expectedData: ReadonlyArray<ManualParsedTrainingSheetEntry>
) => {
  const rows = await getSheetDataSorted(db, sheetId);
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

const expectSyncBetween = async (
  deps: SyncTrainingSheetDependencies,
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

describe('Sync equipment training sheets', () => {
  let db: Client;
  let deps: SyncTrainingSheetDependencies;
  const equipmentId = faker.string.uuid() as UUID;

  beforeEach(async () => {
    db = createClient({url: ':memory:'});
    deps = createSyncTrainingSheetDependencies(db);
    getRightOrFail(await ensureEventTableExists(db)());
    await ensureDBTablesExist(db);
  });

  describe('empty sheet', () => {
    const sheetId = EMPTY.apiResp.spreadsheetId!;
    const syncIntervalMs = 20_000;
    let startTime: Date, endTime: Date;
    beforeEach(async () => {
      startTime = new Date();
      await runSyncEquipmentTrainingSheets(deps, google, syncIntervalMs, db, [
        generateRegisterEvent(equipmentId, sheetId),
      ]);
      endTime = new Date();
    });
    it('produces no rows', () =>
      expectSheetDataMatches(db, sheetId, EMPTY.entries));
    it('sync recorded', () =>
      expectSyncBetween(deps, sheetId, startTime, O.some(endTime)));
    it('no last training sheet row read', async () => {
      expect(
        getRightOrFail(await deps.lastTrainingSheetRowRead(sheetId)())
      ).toStrictEqual({});
    });
    describe('re-sync run again within sync interval', () => {
      let beforeResync: Date;
      beforeEach(async () => {
        beforeResync = new Date();
        await runSyncEquipmentTrainingSheets(deps, google, syncIntervalMs, db, [
          generateRegisterEvent(equipmentId, sheetId),
        ]);
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
        await runSyncEquipmentTrainingSheets(deps, google, syncIntervalMs, db, [
          generateRegisterEvent(equipmentId, sheetId),
        ]);
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
      await runSyncEquipmentTrainingSheets(deps, google, syncIntervalMs, db, [
        generateRegisterEvent(equipmentId, sheetId),
      ]);
      endTime = new Date();
    });
    it('produces expected rows for a full sync', () =>
      expectSheetDataMatches(db, sheetId, METAL_LATHE.entries));
    it('sync recorded', () =>
      expectSyncBetween(deps, sheetId, startTime, O.some(endTime)));
    it('last training sheet row read points at end of sheet', async () => {
      expect(
        getRightOrFail(await deps.lastTrainingSheetRowRead(sheetId)())
      ).toStrictEqual({
        [METAL_LATHE.metadata.sheets[0].properties.title]:
          METAL_LATHE.entries.length,
      });
    });
    describe('re-sync run again within sync interval', () => {
      let beforeResync: Date;
      beforeEach(async () => {
        beforeResync = new Date();
        await runSyncEquipmentTrainingSheets(deps, google, syncIntervalMs, db, [
          generateRegisterEvent(equipmentId, sheetId),
        ]);
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
        await runSyncEquipmentTrainingSheets(deps, google, syncIntervalMs, db, [
          generateRegisterEvent(equipmentId, sheetId),
        ]);
      });

      it('sync recorded', () =>
        expectSyncBetween(deps, sheetId, beforeResync, O.none));

      it('last training sheet row read still points at end of sheet', async () => {
        expect(
          getRightOrFail(await deps.lastTrainingSheetRowRead(sheetId)())
        ).toStrictEqual({
          [METAL_LATHE.metadata.sheets[0].properties.title]:
            METAL_LATHE.entries.length,
        });
      });
    });
  });
});
