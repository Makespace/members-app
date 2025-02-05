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
    let cachedData: ReadonlyArray<{
      cache_entry_id: string;
      cached_timestamp: Date;
      sheet_id: string;
      equipment_id: string;
      cached_data: t.Validation<
        ReadonlyArray<
          | EventOfType<'EquipmentTrainingQuizResult'>
          | EventOfType<'EquipmentTrainingQuizSync'>
        >
      >;
    }>;
    beforeEach(async () => {
      const db = libsqlClient.createClient({url: ':memory:'});
      await ensureCachedSheetDataTableExists(db)();
      getRightOrFail(
        await cacheSheetData(db)(cacheTimestamp, sheetId, [
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
        ])()
      );
      console.log(await db.execute('SELECT * FROM cached_sheet_data'));

      cachedData = getRightOrFail(await getCachedSheetData(db)()());
    });
    it('Each sheet is cached', () => {
      expect(cachedData).toHaveLength(1); // 1 sheet
    });
    // it('All events cached are returned', () => {
    //   expect(getRightOrFail(cachedData[0].cached_data)).toHaveLength(2); // 2 events.
    // });
    // it('Event cache is correctly labeled', () => {
    //   expect(cachedData[0].equipment_id).toStrictEqual(equipmentId);
    //   expect(cachedData[0].sheet_id).toStrictEqual(sheetId);
    //   expect(cachedData[0].cached_timestamp).toStrictEqual(cacheTimestamp);
    // });
  });
});
