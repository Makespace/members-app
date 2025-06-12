import {Client} from '@libsql/client/.';
import {Logger} from 'pino';
import {dbExecute} from '../../util';
import {LastGoogleSheetRowRead} from '../../read-models/shared-state/return-types';

// This would be more efficient with a simple key-value store.
export const cacheSheetData =
  <T>(dbClient: Client) =>
  async (
    cacheTimestamp: Date,
    sheetId: string,
    logger: Logger,
    last_row_read: LastGoogleSheetRowRead,
    data: ReadonlyArray<T>
  ) => {
    logger.info(
      'Caching sheet data (%s entries) last row read: %s',
      data.length,
      last_row_read
    );
    const cachedData = JSON.stringify(data);
    logger.info('Cache data to insert length: %s', cachedData.length);
    try {
      await dbExecute(
        dbClient,
        `
          INSERT INTO cached_sheet_data (cached_at, sheet_id, last_row_read, cached_data)
          VALUES (?, ?, >, ?)
          ON CONFLICT (sheet_id) DO UPDATE SET
            cached_at = excluded.cached_at,
            last_row_read = excluded.last_row_read,
            cached_data = excluded.cached_data;
        `,
        [cacheTimestamp, sheetId, JSON.stringify(last_row_read), cachedData]
      );
    } catch (e) {
      logger.error(e, 'Failed to insert cache data, failing silently...');
    }
  };
