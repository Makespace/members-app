import * as libsqlClient from '@libsql/client';

import {
  cacheSheetData,
  getCachedSheetData,
} from '../../src/init-dependencies/google/get-cached-sheet-data';
import {UUID} from 'io-ts-types';
import * as t from 'io-ts';
import {faker} from '@faker-js/faker';
import {constructEvent, EventOfType} from '../../src/types/domain-event';
import {getRightOrFail} from '../helpers';
import {ensureCachedSheetDataTableExists} from '../../src/init-dependencies/google/ensure-cached-sheet-data-table-exists';

describe('Cache sheet data', () => {
  describe('Cache then restore', () => {
    const equipmentId = '326e8fda-7be8-4cd8-87d5-7cdfafebf996' as UUID;
    const sheetId = 'myTestingSheetId';
    const cacheTimestamp = new Date(2024, 1, 23, 4, 23, 45);
    const trainingQuizResult = {
      equipmentId: equipmentId,
      trainingSheetId: sheetId,
      memberNumberProvided: faker.number.int(),
      emailProvided: 'beans@bob.co.uk',
      score: 23,
      id: '1a3eeb99-dd7a-4f55-a018-6f5e2678fc14' as UUID,
      maxScore: 23,
      percentage: 100,
      timestampEpochMS: 1738623209,
    };
    let cachedData: ReadonlyArray<{
      cached_at: Date;
      sheet_id: string;
      cached_data: t.Validation<
        ReadonlyArray<
          | EventOfType<'EquipmentTrainingQuizResult'>
          | EventOfType<'EquipmentTrainingQuizSync'>
        >
      >;
    }>;
    let db: libsqlClient.Client;
    beforeEach(async () => {
      db = libsqlClient.createClient({url: ':memory:'});
      await ensureCachedSheetDataTableExists(db)();
      getRightOrFail(
        await cacheSheetData(db)(cacheTimestamp, sheetId, [
          constructEvent('EquipmentTrainingQuizSync')({
            equipmentId,
          }),
          constructEvent('EquipmentTrainingQuizResult')(trainingQuizResult),
        ])()
      );
      cachedData = getRightOrFail(await getCachedSheetData(db)()());
    });
    it('Each sheet is cached', () => {
      expect(cachedData).toHaveLength(1); // 1 sheet
    });
    it('All events cached are returned', () => {
      const returnedCachedData = getRightOrFail(cachedData[0].cached_data);
      expect(returnedCachedData).toHaveLength(2); // 2 events.
      returnedCachedData.forEach(e =>
        expect(e.equipmentId).toStrictEqual(equipmentId)
      );
      expect(
        returnedCachedData.find(e => e.type === 'EquipmentTrainingQuizResult')!
      ).toMatchObject(trainingQuizResult);
    });
    it('Event cache is correctly labeled', () => {
      expect(cachedData[0].sheet_id).toStrictEqual(sheetId);
      expect(cachedData[0].cached_at).toStrictEqual(cacheTimestamp);
    });

    describe('Overwrite cache then restore', () => {
      const newCacheTimestamp = new Date(2024, 1, 23, 5, 23, 45);
      let cachedDataAfter: ReadonlyArray<{
        cached_at: Date;
        sheet_id: string;
        cached_data: t.Validation<
          ReadonlyArray<
            | EventOfType<'EquipmentTrainingQuizResult'>
            | EventOfType<'EquipmentTrainingQuizSync'>
          >
        >;
      }>;
      beforeEach(async () => {
        getRightOrFail(
          await cacheSheetData(db)(newCacheTimestamp, sheetId, [
            constructEvent('EquipmentTrainingQuizSync')({
              equipmentId,
            }),
            constructEvent('EquipmentTrainingQuizResult')({
              equipmentId: equipmentId,
              trainingSheetId: sheetId,
              memberNumberProvided: faker.number.int(),
              emailProvided: 'beans@bob.co.uk',
              score: 23,
              id: '1a3eeb99-dd7a-4f55-a018-6f5e2678fc14' as UUID,
              maxScore: 23,
              percentage: 100,
              timestampEpochMS: 1738623209,
            }),
            constructEvent('EquipmentTrainingQuizResult')({
              equipmentId: equipmentId,
              trainingSheetId: sheetId,
              memberNumberProvided: faker.number.int(),
              emailProvided: 'fred@bob.co.uk',
              score: 17,
              id: 'bbbbeb99-aa7a-4f55-a018-ffff2678feee' as UUID,
              maxScore: 23,
              percentage: 74,
              timestampEpochMS: 1738623333,
            }),
          ])()
        );
        cachedDataAfter = getRightOrFail(await getCachedSheetData(db)()());
      });
      it('Each sheet is cached', () => {
        expect(cachedDataAfter).toHaveLength(1); // 1 sheet
      });
      it('All events cached are returned', () => {
        expect(getRightOrFail(cachedDataAfter[0].cached_data)).toHaveLength(3); // 3 events.
      });
      it('Event cache is correctly labeled', () => {
        expect(cachedDataAfter[0].sheet_id).toStrictEqual(sheetId);
        expect(cachedDataAfter[0].cached_at).toStrictEqual(newCacheTimestamp);
      });
    });
    describe('Cache multiple equipment', () => {
      const secondSheetCacheTimestamp = new Date(2024, 1, 23, 5, 23, 45);
      const secondEquipmentId = 'ed779c68-d165-45b3-bd0f-5590021d5337' as UUID;
      const secondSheetId = 'secondSheetId';
      let cachedDataAfter: ReadonlyArray<{
        cached_at: Date;
        sheet_id: string;
        cached_data: t.Validation<
          ReadonlyArray<
            | EventOfType<'EquipmentTrainingQuizResult'>
            | EventOfType<'EquipmentTrainingQuizSync'>
          >
        >;
      }>;
      let firstSheetData: (typeof cachedDataAfter)[0];
      let secondSheetData: (typeof cachedDataAfter)[0];
      beforeEach(async () => {
        getRightOrFail(
          await cacheSheetData(db)(secondSheetCacheTimestamp, secondSheetId, [
            constructEvent('EquipmentTrainingQuizSync')({
              equipmentId: secondEquipmentId,
            }),
            constructEvent('EquipmentTrainingQuizResult')({
              equipmentId: secondEquipmentId,
              trainingSheetId: secondSheetId,
              memberNumberProvided: faker.number.int(),
              emailProvided: 'beans@bob.co.uk',
              score: 10,
              id: 'e139bb51-af9b-420d-87cf-53417491fdb4' as UUID,
              maxScore: 10,
              percentage: 100,
              timestampEpochMS: 1738627209,
            }),
          ])()
        );
        cachedDataAfter = getRightOrFail(await getCachedSheetData(db)()());
        firstSheetData = cachedDataAfter.find(
          data => data.sheet_id === sheetId
        )!;
        secondSheetData = cachedDataAfter.find(
          data => data.sheet_id === secondSheetId
        )!;
      });
      it('Event cache is correctly labeled', () => {
        expect(firstSheetData.sheet_id).toStrictEqual(sheetId);
        expect(firstSheetData.cached_at).toStrictEqual(cacheTimestamp);
        expect(secondSheetData.sheet_id).toStrictEqual(secondSheetId);
        expect(secondSheetData.cached_at).toStrictEqual(
          secondSheetCacheTimestamp
        );
      });
      it('All events cached are returned', () => {
        expect(getRightOrFail(firstSheetData.cached_data)).toHaveLength(2);
        expect(getRightOrFail(secondSheetData.cached_data)).toHaveLength(2);
      });
    });
  });
});
