import * as libsqlClient from '@libsql/client';

import {
  cacheSheetData,
  getCachedSheetData,
} from '../../src/init-dependencies/google/get-cached-sheet-data';
import {UUID} from 'io-ts-types';
import {faker} from '@faker-js/faker';
import {constructEvent, EventOfType} from '../../src/types/domain-event';
import {getRightOrFail} from '../helpers';
import {ensureCachedSheetDataTableExists} from '../../src/init-dependencies/google/ensure-cached-sheet-data-table-exists';

describe('Cache sheet data', () => {
  describe('Cache then restore', () => {
    const equipmentId = '326e8fda-7be8-4cd8-87d5-7cdfafebf996' as UUID;
    const sheetId = 'myTestingSheetId';
    let cachedData: ReadonlyArray<
      | EventOfType<'EquipmentTrainingQuizResult'>
      | EventOfType<'EquipmentTrainingQuizSync'>
    >;
    beforeEach(async () => {
      const db = libsqlClient.createClient({url: ':memory:'});
      await ensureCachedSheetDataTableExists(db)();
      await cacheSheetData(db)(new Date(2024, 1, 23, 4, 23, 45), sheetId, [
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
      ])();
      cachedData = getRightOrFail(await getCachedSheetData(db)()());
    });
    it('All events cached are returned', () => {
      expect(cachedData).toHaveLength(2);
    });
  });
});
