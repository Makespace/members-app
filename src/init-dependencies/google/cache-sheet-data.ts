import {Client} from '@libsql/client/.';
import {Logger} from 'pino';
import * as O from 'fp-ts/Option';
import {dbExecute} from '../../util';
import {LastGoogleSheetRowRead} from '../../dependencies';

// This would be more efficient with a simple key-value store.
export const cacheSheetData =
  <T>(dbClient: Client) =>
  async (
    cacheTimestamp: Date,
    last_row_read: LastGoogleSheetRowRead,
    sheetId: string,
    logger: Logger,
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
        [
          cacheTimestamp,
          sheetId,
          O.getOrElse<null | number>(() => null)(last_row_read),
          cachedData,
        ]
      );
    } catch (e) {
      logger.error(e, 'Failed to insert cache data, failing silently...');
    }
  };
