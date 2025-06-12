import {Client} from '@libsql/client/.';
import {Logger} from 'pino';
import {dbExecute} from '../../util';

// This would be more efficient with a simple key-value store.
export const cacheSheetData =
  <T>(dbClient: Client) =>
  async (
    cacheTimestamp: Date,
    sheetId: string,
    logger: Logger,
    data: ReadonlyArray<T>
  ) => {
    logger.info('Caching sheet data (%s entries)', data.length);
    const cachedData = JSON.stringify(data);
    logger.info('Cache data to insert length: %s', cachedData.length);
    try {
      await dbExecute(
        dbClient,
        `
          INSERT INTO cached_sheet_data (cached_at, sheet_id, cached_data)
          VALUES (?, ?, ?)
          ON CONFLICT (sheet_id) DO UPDATE SET
            cached_at = excluded.cached_at,
            last_row_read = excluded.last_row_read,
            cached_data = excluded.cached_data;
        `,
        [cacheTimestamp, sheetId, cachedData]
      );
    } catch (e) {
      logger.error(e, 'Failed to insert cache data, failing silently...');
    }
  };
