import {Client, createClient} from '@libsql/client';
import {ensureEventTableExists} from '../../src/init-dependencies/event-store/ensure-events-table-exists';
import {ensureDBTablesExist} from '../../src/sync-worker/google/ensure-sheet-data-tables-exist';
import {getRightOrFail} from '../helpers';
import {faker} from '@faker-js/faker';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {clearTrainingSheetCache} from '../../src/sync-worker/db/clear_training_sheet_cache';
import {clearTroubleTicketCache} from '../../src/sync-worker/db/clear_trouble_ticket_cache';
import {getSheetData} from '../../src/sync-worker/db/get_sheet_data';
import {lastSync} from '../../src/sync-worker/db/last_sync';
import {getTrainingSheetsToSync} from '../../src/sync-worker/db/get_training_sheets_to_sync';
import {getTroubleTicketData} from '../../src/sync-worker/db/get_trouble_ticket_data';
import {lastTrainingSheetRowRead} from '../../src/sync-worker/db/last_training_sheet_row_read';
import {lastTroubleTicketRowRead} from '../../src/sync-worker/db/last_trouble_ticket_row_read';
import {storeSync} from '../../src/sync-worker/db/store_sync';

const expectToBeRight = async <T>(task: TE.TaskEither<T, void>) =>
  expect(getRightOrFail(await task())).toBeUndefined();

describe('Test sync worker db', () => {
  let db: Client;
  beforeEach(async () => {
    db = createClient({url: ':memory:'});
    getRightOrFail(await ensureEventTableExists(db)());
    await ensureDBTablesExist(db);
  });

  describe('Empty database', () => {
    const sheetId = faker.string.alphanumeric();
    it('Get last sync returns none', async () =>
      expect(getRightOrFail(await lastSync(db)(sheetId)())).toStrictEqual(
        O.none
      ));
    it('Clear training sheet data reports success', () =>
      expectToBeRight(clearTrainingSheetCache(db)(sheetId)));
    it('Clear trouble ticket data reports success', () =>
      expectToBeRight(clearTroubleTicketCache(db)(sheetId)));
    it('Get sheet data returns nothing', async () =>
      expect(getRightOrFail(await getSheetData(db)(sheetId)())).toStrictEqual(
        []
      ));
    it('Get trouble ticket data returns nothing', async () =>
      expect(
        getRightOrFail(await getTroubleTicketData(db, O.some(sheetId))()())
      ).toStrictEqual(O.some([])));
    it('Get training sheets to sync returns nothing', async () =>
      expect(
        getRightOrFail(await getTrainingSheetsToSync(db)()())
      ).toStrictEqual(new Map()));
    it('Last training sheet row read is none', async () =>
      expect(
        getRightOrFail(await lastTrainingSheetRowRead(db)(sheetId)())
      ).toStrictEqual({}));
    it('Last trouble ticket row read is none', async () =>
      expect(
        getRightOrFail(await lastTroubleTicketRowRead(db)(sheetId)())
      ).toStrictEqual({}));
  });

  describe('Store as sync', () => {
    const sheetId = faker.string.alphanumeric();
    const date = faker.date.past();
    beforeEach(() => storeSync(db)(sheetId, date)());

    it('Get last sync returns the sync date', async () =>
      expect(getRightOrFail(await lastSync(db)(sheetId)())).toStrictEqual(
        O.some(date)
      ));

    it('Get last sync on a different sheet returns nothing', async () =>
      expect(
        getRightOrFail(await lastSync(db)(faker.string.alphanumeric())())
      ).toStrictEqual(O.none));

    describe('Sync again on the same sheet', () => {
      const newDate = faker.date.future({refDate: date});
      beforeEach(() => storeSync(db)(sheetId, newDate)());
      it('Get last sync returns the new sync date', async () =>
        expect(getRightOrFail(await lastSync(db)(sheetId)())).toStrictEqual(
          O.some(newDate)
        ));
    });

    describe('Sync again on a different sheet', () => {
      const newSheetId = faker.string.alphanumeric();
      const newDate = faker.date.past();
      beforeEach(() => storeSync(db)(newSheetId, newDate)());
      it('Existing sheet sync data is unchanged', async () =>
        expect(getRightOrFail(await lastSync(db)(sheetId)())).toStrictEqual(
          O.some(date)
        ));
      it('Get last sync returns the new sheet sync date', async () =>
        expect(getRightOrFail(await lastSync(db)(newSheetId)())).toStrictEqual(
          O.some(newDate)
        ));
    });
  });
});
