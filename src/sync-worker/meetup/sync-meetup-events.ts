import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {SyncWorkerDependencies} from '../dependencies';
import {fetchMeetupIcal} from './fetch-meetup-ical';

type SyncMeetupDependencies = Pick<
  SyncWorkerDependencies,
  'logger' | 'storeSync' | 'lastSync' | 'storeMeetupEvents' | 'clearMeetupEvents'
>;

const MEETUP_SYNC_ID = 'meetup';

export const syncMeetupEvents = async (
  deps: SyncMeetupDependencies,
  meetupIcalUrl: string,
  syncIntervalMs: number
): Promise<void> => {
  const log = deps.logger.child({source: 'meetup'});

  const lastSync = await deps.lastSync(MEETUP_SYNC_ID)();
  if (
    E.isRight(lastSync) &&
    O.isSome(lastSync.right) &&
    Date.now() - lastSync.right.value.getTime() < syncIntervalMs
  ) {
    log.debug(
      'Skipping Meetup sync as last sync was recent: %s',
      lastSync.right.value.toISOString()
    );
    return;
  }

  const storeSyncResult = await deps.storeSync(MEETUP_SYNC_ID, new Date())();
  if (E.isLeft(storeSyncResult)) {
    log.warn('Failed to record sync time: %s', storeSyncResult.left);
    return;
  }

  log.info('Fetching Meetup events from %s', meetupIcalUrl);
  const events = await fetchMeetupIcal(log, meetupIcalUrl)();

  if (E.isLeft(events)) {
    log.error('Failed to fetch Meetup events: %s', events.left);
    return;
  }

  log.info('Fetched %d Meetup events, storing...', events.right.length);

  const clearResult = await deps.clearMeetupEvents()();
  if (E.isLeft(clearResult)) {
    log.error('Failed to clear old Meetup events: %s', clearResult.left);
    return;
  }

  const storeResult = await deps.storeMeetupEvents(events.right)();
  if (E.isLeft(storeResult)) {
    log.error('Failed to store Meetup events: %s', storeResult.left);
    return;
  }

  log.info('Successfully synced %d Meetup events', events.right.length);
};
