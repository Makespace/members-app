import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import {Dependencies} from './dependencies';
import {SharedReadModel} from './read-models/shared-state';

export const loadCachedSheetData = async (
  getCachedSheetData: Dependencies['getCachedSheetData'],
  logger: Logger,
  updateState: SharedReadModel['updateState']
) => {
  const events = await getCachedSheetData()();
  if (E.isLeft(events)) {
    // Potential pitfall here - transient db errors could produce large spikes in processing.
    // Tradeoff is that an error/bug in cached sheet data doesn't bring down the application.
    logger.error(
      events.left,
      'Failed to load any cached external events data - continuing anyway...'
    );
  } else {
    logger.info(
      'Loaded events for %s pieces of equipment from external events data cache',
      events.right.length
    );
    events.right.forEach(cachedSheetData => {
      if (E.isLeft(cachedSheetData.cached_data)) {
        logger.info(
          'Failed to load events for sheet %s cached at %s, skipping...',
          cachedSheetData.sheet_id,
          cachedSheetData.cached_at.toISOString()
        );
      } else {
        logger.info(
          'Loaded % events for sheet %s, cached at %s',
          cachedSheetData.cached_data.right.length,
          cachedSheetData.sheet_id,
          cachedSheetData.cached_at.toISOString()
        );
        cachedSheetData.cached_data.right.forEach(updateState);
      }
    });
  }
};
