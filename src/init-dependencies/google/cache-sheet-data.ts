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
    data: ReadonlyArray<T>,
    append: boolean
  ) => {
    let dataToStore = data;
    try {
      if (append) {
        // There is a race condition here however it doesn't affect us currently.
        const current = await dbExecute(
          dbClient,
          'SELECT cached_data FROM cached_sheet_data WHERE sheet_id = ? LIMIT 1',
          [sheetId]
        );
        if (current.rows.length > 1) {
          const existing = JSON.parse(
            (current.rows[0]['cached_data'] ?? '[]') as string
          ) as ReadonlyArray<T>;

          logger.info(
            'Found %s existing entries, appending new data onto the end',
            existing.length
          );
          dataToStore = existing.concat(...data);
        }
      }

      logger.info('Caching sheet data (%s entries)', data.length);
      const cachedData = JSON.stringify(dataToStore);
      logger.info('Cache data to insert length: %s', cachedData.length);

      await dbExecute(
        dbClient,
        `
          INSERT INTO cached_sheet_data (cached_at, sheet_id, cached_data)
          VALUES (?, ?, ?)
          ON CONFLICT (sheet_id) DO UPDATE SET
            cached_at = excluded.cached_at,
            cached_data = excluded.cached_data;
        `,
        [cacheTimestamp, sheetId, cachedData]
      );
    } catch (e) {
      logger.error(e, 'Failed to insert cache data, failing silently...');
    }
  };
