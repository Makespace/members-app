import {createClient, Client} from '@libsql/client';
import {ensureEventTableExists} from '../../src/init-dependencies/event-store/ensure-events-table-exists';
import {ensureGoogleDBTablesExist} from '../../src/sync-worker/google/ensure-sheet-data-tables-exist';
import {
  SyncTroubleTicketDependencies,
  syncTroubleTickets,
} from '../../src/sync-worker/sync_trouble_ticket';
import {getRightOrFail, getSomeOrFail} from '../helpers';
import {
  byTimestamp,
  createSyncTroubleTicketDependencies,
  expectSyncBetween,
} from './util';
import {
  EMPTY,
  ManualParsedTroubleTicketEntry,
  TROUBLE_TICKETS_EXAMPLE,
} from '../data/google_sheet_data';
import {localGoogleHelpers as google} from '../init-dependencies/pull-local-google';
import {setTimeout} from 'node:timers/promises';
import * as RA from 'fp-ts/ReadonlyArray';
import {getTroubleTicketData} from '../../src/sync-worker/db/get_trouble_ticket_data';
import * as O from 'fp-ts/Option';

const getTroubleTicketDataSorted = async (googleDB: Client, sheetId: string) =>
  RA.sort(byTimestamp)(
    getSomeOrFail(
      getRightOrFail(await getTroubleTicketData(googleDB, O.some(sheetId))()())
    )
  );

const expectTroubleTicketDataMatches = async (
  googleDB: Client,
  sheetId: string,
  expectedData: ReadonlyArray<ManualParsedTroubleTicketEntry>
) => {
  const rows = await getTroubleTicketDataSorted(googleDB, sheetId);
  expect(rows).toHaveLength(expectedData.length);
  for (const [actual, expected] of RA.zip(RA.sort(byTimestamp)(expectedData))(
    rows
  )) {
    expect(actual.response_submitted.getTime()).toStrictEqual(
      expected.timestampEpochMS
    );
    expect(actual.submitted_email).toStrictEqual(expected.emailProvided);
    expect(actual.submitted_equipment).toStrictEqual(
      expected.whichEquipmentWereYouUsing
    );
    expect(actual.submitted_name).toStrictEqual(expected.nameProvided);
    expect(actual.submitted_membership_number).toStrictEqual(
      expected.membershipNumberProvided
    );
  }
};

describe('Sync trouble ticket sheets', () => {
  let googleDB: Client;
  let eventDB: Client;
  let deps: SyncTroubleTicketDependencies;

  beforeEach(async () => {
    googleDB = createClient({url: ':memory:'});
    eventDB = createClient({url: ':memory:'});
    deps = createSyncTroubleTicketDependencies(googleDB);
    getRightOrFail(await ensureEventTableExists(eventDB)());
    await ensureGoogleDBTablesExist(googleDB)();
  });

  describe('empty sheet', () => {
    const sheetId = EMPTY.apiResp.spreadsheetId!;
    const syncIntervalMs = 20_000;
    let startTime: Date, endTime: Date;
    beforeEach(async () => {
      startTime = new Date();
      await syncTroubleTickets(deps, google, sheetId, syncIntervalMs);
      endTime = new Date();
    });
    it('produces no rows', () =>
      expectTroubleTicketDataMatches(googleDB, sheetId, EMPTY.entries));
    it('sync recorded', () =>
      expectSyncBetween(deps, sheetId, startTime, O.some(endTime)));
    it('no last trouble ticket row read', async () => {
      expect(
        getRightOrFail(await deps.lastTroubleTicketRowRead(sheetId)())
      ).toStrictEqual({});
    });
    describe('re-sync run again within sync interval', () => {
      let beforeResync: Date;
      beforeEach(async () => {
        beforeResync = new Date();
        await syncTroubleTickets(deps, google, sheetId, syncIntervalMs);
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
        await syncTroubleTickets(deps, google, sheetId, syncIntervalMs);
      });

      it('sync recorded', () =>
        expectSyncBetween(deps, sheetId, beforeResync, O.none));
    });
  });

  describe('example data', () => {
    const sheetId = TROUBLE_TICKETS_EXAMPLE.apiResp.spreadsheetId!;
    const syncIntervalMs = 20_000;
    let startTime: Date, endTime: Date;
    beforeEach(async () => {
      startTime = new Date();
      await syncTroubleTickets(deps, google, sheetId, syncIntervalMs);
      endTime = new Date();
    });
    it('produces expected rows for a full sync', () =>
      expectTroubleTicketDataMatches(
        googleDB,
        sheetId,
        TROUBLE_TICKETS_EXAMPLE.entries
      ));
    it('sync recorded', () =>
      expectSyncBetween(deps, sheetId, startTime, O.some(endTime)));
    it('last trouble ticket row read points at end of sheet', async () => {
      expect(
        getRightOrFail(await deps.lastTroubleTicketRowRead(sheetId)())
      ).toStrictEqual({
        [TROUBLE_TICKETS_EXAMPLE.metadata.sheets[0].properties.title]:
          TROUBLE_TICKETS_EXAMPLE.entries.length + 1, // The entries don't include the row header.
      });
    });
    describe('re-sync run again within sync interval', () => {
      let beforeResync: Date;
      beforeEach(async () => {
        beforeResync = new Date();
        await syncTroubleTickets(deps, google, sheetId, syncIntervalMs);
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
        await syncTroubleTickets(deps, google, sheetId, syncIntervalMs);
      });

      it('sync recorded', () =>
        expectSyncBetween(deps, sheetId, beforeResync, O.none));

      it('last training sheet row read still points at end of sheet', async () => {
        expect(
          getRightOrFail(await deps.lastTroubleTicketRowRead(sheetId)())
        ).toStrictEqual({
          [TROUBLE_TICKETS_EXAMPLE.metadata.sheets[0].properties.title]:
            TROUBLE_TICKETS_EXAMPLE.entries.length + 1, // The entries don't include the row header.
        });
      });
    });
  });
});
