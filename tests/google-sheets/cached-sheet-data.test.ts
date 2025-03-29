import * as libsqlClient from '@libsql/client';

import {getCachedSheetData} from '../../src/init-dependencies/google/get-cached-sheet-data';
import {UUID} from 'io-ts-types';
import * as t from 'io-ts';
import {faker} from '@faker-js/faker';
import {constructEvent, EventOfType} from '../../src/types/domain-event';
import {getRightOrFail, getSomeOrFail} from '../helpers';
import {ensureCachedSheetDataTableExists} from '../../src/init-dependencies/google/ensure-cached-sheet-data-table-exists';
import pino from 'pino';
import {cacheSheetData} from '../../src/init-dependencies/google/cache-sheet-data';

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
    let cachedData: {
      cached_at: Date;
      cached_data: t.Validation<
        ReadonlyArray<
          | EventOfType<'EquipmentTrainingQuizResult'>
          | EventOfType<'EquipmentTrainingQuizSync'>
        >
      >;
    };
    let db: libsqlClient.Client;
    beforeEach(async () => {
      db = libsqlClient.createClient({url: ':memory:'});
      await ensureCachedSheetDataTableExists(db)();
      await cacheSheetData(db)(
        cacheTimestamp,
        sheetId,
        pino({level: 'silent'}),
        [
          constructEvent('EquipmentTrainingQuizSync')({
            equipmentId,
          }),
          constructEvent('EquipmentTrainingQuizResult')(trainingQuizResult),
        ]
      );
      cachedData = getSomeOrFail(
        getRightOrFail(await getCachedSheetData(db)(sheetId)())
      );
    });
    it('All events cached are returned', () => {
      const returnedCachedData = getRightOrFail(cachedData.cached_data);
      expect(returnedCachedData).toHaveLength(2); // 2 events.
      returnedCachedData.forEach(e =>
        expect(e.equipmentId).toStrictEqual(equipmentId)
      );
      expect(
        returnedCachedData.find(e => e.type === 'EquipmentTrainingQuizResult')!
      ).toMatchObject(trainingQuizResult);
    });
    it('Event cache is correctly labeled', () => {
      expect(cachedData.cached_at).toStrictEqual(cacheTimestamp);
    });

    describe('Overwrite cache then restore', () => {
      const newCacheTimestamp = new Date(2024, 1, 23, 5, 23, 45);
      let cachedDataAfter: {
        cached_at: Date;
        cached_data: t.Validation<
          ReadonlyArray<
            | EventOfType<'EquipmentTrainingQuizResult'>
            | EventOfType<'EquipmentTrainingQuizSync'>
          >
        >;
      };
      beforeEach(async () => {
        await cacheSheetData(db)(
          newCacheTimestamp,
          sheetId,
          pino({level: 'silent'}),
          [
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
          ]
        );
        cachedDataAfter = getSomeOrFail(
          getRightOrFail(await getCachedSheetData(db)(sheetId)())
        );
      });
      it('All events cached are returned', () => {
        expect(getRightOrFail(cachedDataAfter.cached_data)).toHaveLength(3); // 3 events.
      });
      it('Event cache is correctly labeled', () => {
        expect(cachedDataAfter.cached_at).toStrictEqual(newCacheTimestamp);
      });
    });
    describe('Cache multiple equipment', () => {
      const secondSheetCacheTimestamp = new Date(2024, 1, 23, 5, 23, 45);
      const secondEquipmentId = 'ed779c68-d165-45b3-bd0f-5590021d5337' as UUID;
      const secondSheetId = 'secondSheetId';
      let firstSheetData: {
        cached_at: Date;
        cached_data: t.Validation<
          ReadonlyArray<
            | EventOfType<'EquipmentTrainingQuizResult'>
            | EventOfType<'EquipmentTrainingQuizSync'>
          >
        >;
      };
      let secondSheetData: {
        cached_at: Date;
        cached_data: t.Validation<
          ReadonlyArray<
            | EventOfType<'EquipmentTrainingQuizResult'>
            | EventOfType<'EquipmentTrainingQuizSync'>
          >
        >;
      };
      beforeEach(async () => {
        await cacheSheetData(db)(
          secondSheetCacheTimestamp,
          secondSheetId,
          pino({level: 'silent'}),
          [
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
          ]
        );
        firstSheetData = getSomeOrFail(
          getRightOrFail(await getCachedSheetData(db)(sheetId)())
        );
        secondSheetData = getSomeOrFail(
          getRightOrFail(await getCachedSheetData(db)(secondSheetId)())
        );
      });
      it('Event cache is correctly labeled', () => {
        expect(firstSheetData.cached_at).toStrictEqual(cacheTimestamp);
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
