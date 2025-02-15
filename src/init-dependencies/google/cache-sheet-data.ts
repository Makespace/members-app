import {Client} from '@libsql/client/.';
import {Dependencies} from '../../dependencies';
import {Logger} from 'pino';
import {EventOfType} from '../../types/domain-event';

// This would be more efficient with a simple key-value store.
export const cacheSheetData =
  (dbClient: Client): Dependencies['cacheSheetData'] =>
  async (
    cacheTimestamp: Date,
    sheetId: string,
    logger: Logger,
    data: ReadonlyArray<
      | EventOfType<'EquipmentTrainingQuizResult'>
      | EventOfType<'EquipmentTrainingQuizSync'>
    >
  ) => {
    logger.info('Caching sheet data (%s entries)', data.length);
    const cachedData = JSON.stringify(data);
    logger.info('Cache data to insert length: %s', cachedData.length);
    await new Promise(res => setTimeout(res, 5000));
    try {
      await dbClient.execute({
        sql: `
              INSERT INTO cached_sheet_data (cached_at, sheet_id, cached_data)
              VALUES (?, ?, ?)
              ON CONFLICT (sheet_id) DO UPDATE SET
                cached_at = excluded.cached_at,
                cached_data = excluded.cached_data;
            `,
        args: [cacheTimestamp, sheetId, cachedData],
      });
    } catch (e) {
      logger.error(e, 'Failed to insert cache data, failing silently...');
    }
    // return TE.tryCatch(
    //   () =>
    //     dbClient.execute({

    //     }),
    //   failure('Failed to insert cached sheet data')
    // );
  };
