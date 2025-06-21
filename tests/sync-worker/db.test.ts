import {Client, createClient} from '@libsql/client';
import {ensureEventTableExists} from '../../src/init-dependencies/event-store/ensure-events-table-exists';
import {ensureDBTablesExist} from '../../src/sync-worker/google/ensure-sheet-data-tables-exist';
import {getRightOrFail, getSomeOrFail} from '../helpers';
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
import {storeTrainingSheetRowsRead} from '../../src/sync-worker/db/store_training_sheet_rows_read';
import {
  SheetDataTable,
  TroubleTicketDataTable,
} from '../../src/sync-worker/google/sheet-data-table';
import {UUID} from 'io-ts-types';
import {
  byTimestamp,
  generateRegisterSheetEvent,
  generateRemoveSheetEvent,
  pushEvents,
  testLogger,
} from './util';
import * as RA from 'fp-ts/ReadonlyArray';
import {storeTroubleTicketRowsRead} from '../../src/sync-worker/db/store_trouble_ticket_rows_read';
import {pipe} from 'fp-ts/lib/function';

const expectToBeRight = async <T>(task: TE.TaskEither<T, void>) =>
  expect(getRightOrFail(await task())).toBeUndefined();

const randomTrainingSheetRow = (
  sheetId: string,
  sheetName: string,
  rowIndex: number
): SheetDataTable['rows'][0] => {
  const score = faker.number.int({max: 20});
  const maxScore = 20;
  return {
    sheet_id: sheetId,
    sheet_name: sheetName,
    row_index: rowIndex,
    response_submitted: faker.date.past(),
    member_number_provided: faker.number.int({max: 10000}),
    email_provided: faker.internet.email(),
    score,
    max_score: maxScore,
    percentage: Math.floor(score / maxScore),
    cached_at: new Date(),
  };
};

const randomTrainingSheetRows = (
  sheetId: string,
  sheetName: string,
  count: number,
  startRowIndex: O.Option<number>
): SheetDataTable['rows'] => {
  const res: SheetDataTable['rows'][0][] = [];
  for (
    let rowIndex = O.getOrElse(() => 1)(startRowIndex);
    rowIndex <= count;
    rowIndex++
  ) {
    res.push(randomTrainingSheetRow(sheetId, sheetName, rowIndex));
  }
  return res;
};

const randomTroubleTicketRow = (
  sheetId: string,
  sheetName: string,
  rowIndex: number
): TroubleTicketDataTable['rows'][0] => ({
  sheet_id: sheetId,
  sheet_name: sheetName,
  row_index: rowIndex,
  response_submitted: faker.date.past(),
  cached_at: new Date(),
  submitted_email: faker.internet.email(),
  submitted_equipment: faker.airline.airplane().name,
  submitted_name: faker.person.fullName(),
  submitted_membership_number: faker.number.int({max: 10000}),
  submitted_response_json: JSON.stringify({
    'Question?': faker.company.catchPhrase(),
  }),
});

const randomTroubleTicketRows = (
  sheetId: string,
  sheetName: string,
  count: number,
  startRowIndex: O.Option<number>
): TroubleTicketDataTable['rows'] => {
  const res: TroubleTicketDataTable['rows'][0][] = [];
  for (
    let rowIndex = O.getOrElse(() => 1)(startRowIndex);
    rowIndex <= count;
    rowIndex++
  ) {
    res.push(randomTroubleTicketRow(sheetId, sheetName, rowIndex));
  }
  return res;
};

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

  describe('Store last sync', () => {
    const sheetId = faker.string.alphanumeric();
    const date = faker.date.past();
    beforeEach(async () =>
      getRightOrFail(await storeSync(db)(sheetId, date)())
    );

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
      beforeEach(async () =>
        getRightOrFail(await storeSync(db)(sheetId, newDate)())
      );
      it('Get last sync returns the new sync date', async () =>
        expect(getRightOrFail(await lastSync(db)(sheetId)())).toStrictEqual(
          O.some(newDate)
        ));
    });

    describe('Sync again on a different sheet', () => {
      const newSheetId = faker.string.alphanumeric();
      const newDate = faker.date.past();
      beforeEach(async () =>
        getRightOrFail(await storeSync(db)(newSheetId, newDate)())
      );
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

  describe('Store training sheet rows', () => {
    const sheetId = faker.string.alphanumeric({length: 12});
    const sheetId2 = faker.string.alphanumeric({length: 12});
    const sheetName = faker.animal.fish();
    const sheetName2 = faker.animal.bird();
    const data: SheetDataTable['rows'] = randomTrainingSheetRows(
      sheetId,
      sheetName,
      4,
      O.none
    );
    const data1_2: SheetDataTable['rows'] = randomTrainingSheetRows(
      sheetId,
      sheetName,
      13,
      O.some(data.length + 1) // +1 because we are generating the next set of rows.
    );
    const data2: SheetDataTable['rows'] = randomTrainingSheetRows(
      sheetId2,
      sheetName2,
      7,
      O.none
    );
    beforeEach(async () =>
      getRightOrFail(await storeTrainingSheetRowsRead(db, testLogger())(data)())
    );

    it('Last training sheet row read indicates all data read', async () =>
      expect(
        getRightOrFail(await lastTrainingSheetRowRead(db)(sheetId)())
      ).toStrictEqual({
        [sheetName]: data.length,
      }));

    it('Get training ticket data', async () =>
      expect(
        RA.sort(byTimestamp)(getRightOrFail(await getSheetData(db)(sheetId)()))
      ).toStrictEqual(RA.sort(byTimestamp)(data)));

    describe('Add more training data for another sheet', () => {
      beforeEach(async () =>
        getRightOrFail(
          await storeTrainingSheetRowsRead(db, testLogger())(data2)()
        )
      );

      it('Get training ticket data for sheet 1 correctly', async () =>
        expect(
          RA.sort(byTimestamp)(
            getRightOrFail(await getSheetData(db)(sheetId)())
          )
        ).toStrictEqual(RA.sort(byTimestamp)(data)));

      it('Get training ticket data for sheet 2 correctly', async () =>
        expect(
          RA.sort(byTimestamp)(
            getRightOrFail(await getSheetData(db)(sheetId2)())
          )
        ).toStrictEqual(RA.sort(byTimestamp)(data2)));

      describe('Clear training sheet data for sheet 1', () => {
        beforeEach(async () =>
          getRightOrFail(await clearTrainingSheetCache(db)(sheetId)())
        );

        it('Get sheet data returns nothing', async () =>
          expect(
            getRightOrFail(await getSheetData(db)(sheetId)())
          ).toStrictEqual([]));

        it('Last training sheet row read is none', async () =>
          expect(
            getRightOrFail(await lastTrainingSheetRowRead(db)(sheetId)())
          ).toStrictEqual({}));

        it('Data for sheet2 is still present', async () =>
          expect(
            RA.sort(byTimestamp)(
              getRightOrFail(await getSheetData(db)(sheetId2)())
            )
          ).toStrictEqual(RA.sort(byTimestamp)(data2)));
      });
    });

    describe('Add more training data for the same sheet', () => {
      beforeEach(async () =>
        getRightOrFail(
          await storeTrainingSheetRowsRead(db, testLogger())(data1_2)()
        )
      );
      it('Last training data row read indicates all data read', async () =>
        expect(
          getRightOrFail(await lastTrainingSheetRowRead(db)(sheetId)())
        ).toStrictEqual({
          [sheetName]: data.length + data1_2.length,
        }));

      it('Sheet data contains all the data', async () =>
        expect(
          RA.sort(byTimestamp)(
            getRightOrFail(await getSheetData(db)(sheetId)())
          )
        ).toStrictEqual(pipe(data, RA.concat(data1_2), RA.sort(byTimestamp))));
    });
  });

  describe('Store empty training sheet rows read', () => {
    const sheetId = faker.string.alphanumeric({length: 12});
    const data: SheetDataTable['rows'] = [];
    beforeEach(async () =>
      getRightOrFail(await storeTrainingSheetRowsRead(db, testLogger())(data)())
    );

    it('Last training sheet row read is none', async () =>
      expect(
        getRightOrFail(await lastTrainingSheetRowRead(db)(sheetId)())
      ).toStrictEqual({}));
  });

  describe('Register a training sheet', () => {
    const equipmentId = faker.string.uuid() as UUID;
    const trainingSheet = faker.string.alphanumeric({length: 12});
    const equipmentId2 = faker.string.uuid() as UUID;
    const trainingSheet2 = faker.string.alphanumeric({length: 12});
    beforeEach(() =>
      pushEvents(db, testLogger(), [
        generateRegisterSheetEvent(equipmentId, trainingSheet),
      ])
    );

    it('Registered training sheet is returned within set to sync', async () =>
      expect(
        getRightOrFail(await getTrainingSheetsToSync(db)()())
      ).toStrictEqual(new Map(Object.entries({[equipmentId]: trainingSheet}))));

    describe('Register a training sheet for second piece of equipment', () => {
      beforeEach(() =>
        pushEvents(db, testLogger(), [
          generateRegisterSheetEvent(equipmentId2, trainingSheet2),
        ])
      );

      it('Registered training sheet is returned for both pieces of equipment', async () => {
        expect(
          getRightOrFail(await getTrainingSheetsToSync(db)()())
        ).toStrictEqual(
          new Map(
            Object.entries({
              [equipmentId]: trainingSheet,
              [equipmentId2]: trainingSheet2,
            })
          )
        );
      });
      describe('Remove training sheet from equipment', () => {
        beforeEach(() =>
          pushEvents(db, testLogger(), [generateRemoveSheetEvent(equipmentId)])
        );
        it('Still registered training sheet is returned within set to sync', async () =>
          expect(
            getRightOrFail(await getTrainingSheetsToSync(db)()())
          ).toStrictEqual(
            new Map(Object.entries({[equipmentId2]: trainingSheet2}))
          ));
      });
    });

    describe('Remove training sheet from equipment', () => {
      beforeEach(() =>
        pushEvents(db, testLogger(), [generateRemoveSheetEvent(equipmentId)])
      );
      it('Get training sheets to sync returns nothing', async () =>
        expect(
          getRightOrFail(await getTrainingSheetsToSync(db)()())
        ).toStrictEqual(new Map()));
    });
  });

  describe('Store trouble ticket rows', () => {
    const sheetId = faker.string.alphanumeric({length: 12});
    const sheetId2 = faker.string.alphanumeric({length: 12});
    const sheetName = faker.animal.fish();
    const sheetName2 = faker.animal.bird();
    const data: TroubleTicketDataTable['rows'] = randomTroubleTicketRows(
      sheetId,
      sheetName,
      4,
      O.none
    );
    const data1_2: TroubleTicketDataTable['rows'] = randomTroubleTicketRows(
      sheetId,
      sheetName,
      13,
      O.some(data.length + 1) // +1 because we are generating the next set of rows.
    );
    const data2: TroubleTicketDataTable['rows'] = randomTroubleTicketRows(
      sheetId2,
      sheetName2,
      7,
      O.none
    );
    beforeEach(async () =>
      getRightOrFail(await storeTroubleTicketRowsRead(db)(data)())
    );

    it('Last trouble ticket row read indicates all data read', async () =>
      expect(
        getRightOrFail(await lastTroubleTicketRowRead(db)(sheetId)())
      ).toStrictEqual({
        [sheetName]: data.length,
      }));

    it('Get trouble ticket data', async () =>
      expect(
        RA.sort(byTimestamp)(
          getSomeOrFail(
            getRightOrFail(await getTroubleTicketData(db, O.some(sheetId))()())
          )
        )
      ).toStrictEqual(RA.sort(byTimestamp)(data)));

    describe('Add more trouble ticket data for another sheet', () => {
      beforeEach(async () =>
        getRightOrFail(await storeTroubleTicketRowsRead(db)(data2)())
      );

      it('Get trouble ticket data for sheet 1 correctly', async () =>
        expect(
          RA.sort(byTimestamp)(
            getSomeOrFail(
              getRightOrFail(
                await getTroubleTicketData(db, O.some(sheetId))()()
              )
            )
          )
        ).toStrictEqual(RA.sort(byTimestamp)(data)));

      it('Get trouble ticket data for sheet 2 correctly', async () =>
        expect(
          RA.sort(byTimestamp)(
            getSomeOrFail(
              getRightOrFail(
                await getTroubleTicketData(db, O.some(sheetId2))()()
              )
            )
          )
        ).toStrictEqual(RA.sort(byTimestamp)(data2)));

      describe('Clear trouble ticket data for sheet 1', () => {
        beforeEach(async () =>
          getRightOrFail(await clearTroubleTicketCache(db)(sheetId)())
        );

        it('Get trouble ticket data returns nothing', async () =>
          expect(
            getRightOrFail(await getTroubleTicketData(db, O.some(sheetId))()())
          ).toStrictEqual(O.some([])));

        it('Last trouble ticket row read is none', async () =>
          expect(
            getRightOrFail(await lastTroubleTicketRowRead(db)(sheetId)())
          ).toStrictEqual({}));

        it('Data for sheet2 is still present', async () =>
          expect(
            RA.sort(byTimestamp)(
              getSomeOrFail(
                getRightOrFail(
                  await getTroubleTicketData(db, O.some(sheetId2))()()
                )
              )
            )
          ).toStrictEqual(RA.sort(byTimestamp)(data2)));
      });
    });

    describe('Add more trouble ticket data for the same sheet', () => {
      beforeEach(async () =>
        getRightOrFail(await storeTroubleTicketRowsRead(db)(data1_2)())
      );
      it('Last trouble ticket row read indicates all data read', async () =>
        expect(
          getRightOrFail(await lastTroubleTicketRowRead(db)(sheetId)())
        ).toStrictEqual({
          [sheetName]: data.length + data1_2.length,
        }));

      it('Trouble ticket data contains all the data', async () =>
        expect(
          RA.sort(byTimestamp)(
            getSomeOrFail(
              getRightOrFail(
                await getTroubleTicketData(db, O.some(sheetId))()()
              )
            )
          )
        ).toStrictEqual(pipe(data, RA.concat(data1_2), RA.sort(byTimestamp))));
    });
  });

  describe('Store empty trouble ticket rows', () => {
    const sheetId = faker.string.alphanumeric({length: 12});
    const data: TroubleTicketDataTable['rows'] = [];
    beforeEach(async () =>
      getRightOrFail(await storeTroubleTicketRowsRead(db)(data)())
    );

    it('Last trouble ticket row read is none', async () =>
      expect(
        getRightOrFail(await lastTroubleTicketRowRead(db)(sheetId)())
      ).toStrictEqual({}));
  });

  describe('Register a training sheet', () => {
    const equipmentId = faker.string.uuid() as UUID;
    const trainingSheet = faker.string.alphanumeric({length: 12});
    const equipmentId2 = faker.string.uuid() as UUID;
    const trainingSheet2 = faker.string.alphanumeric({length: 12});
    beforeEach(() =>
      pushEvents(db, testLogger(), [
        generateRegisterSheetEvent(equipmentId, trainingSheet),
      ])
    );

    it('Registered training sheet is returned within set to sync', async () =>
      expect(
        getRightOrFail(await getTrainingSheetsToSync(db)()())
      ).toStrictEqual(new Map(Object.entries({[equipmentId]: trainingSheet}))));

    describe('Register a training sheet for second piece of equipment', () => {
      beforeEach(() =>
        pushEvents(db, testLogger(), [
          generateRegisterSheetEvent(equipmentId2, trainingSheet2),
        ])
      );

      it('Registered training sheet is returned for both pieces of equipment', async () => {
        expect(
          getRightOrFail(await getTrainingSheetsToSync(db)()())
        ).toStrictEqual(
          new Map(
            Object.entries({
              [equipmentId]: trainingSheet,
              [equipmentId2]: trainingSheet2,
            })
          )
        );
      });
      describe('Remove training sheet from equipment', () => {
        beforeEach(() =>
          pushEvents(db, testLogger(), [generateRemoveSheetEvent(equipmentId)])
        );
        it('Still registered training sheet is returned within set to sync', async () =>
          expect(
            getRightOrFail(await getTrainingSheetsToSync(db)()())
          ).toStrictEqual(
            new Map(Object.entries({[equipmentId2]: trainingSheet2}))
          ));
      });
    });

    describe('Remove training sheet from equipment', () => {
      beforeEach(() =>
        pushEvents(db, testLogger(), [generateRemoveSheetEvent(equipmentId)])
      );
      it('Get training sheets to sync returns nothing', async () =>
        expect(
          getRightOrFail(await getTrainingSheetsToSync(db)()())
        ).toStrictEqual(new Map()));
    });
  });
});
