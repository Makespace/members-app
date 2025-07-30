import {syncTroubleTickets} from './sync_trouble_ticket';
import {syncEquipmentTrainingSheets} from './sync_training_sheet';
import {initDependencies} from './init-dependencies';
import {GoogleHelpers} from './google/pull_sheet_data';
import {setTimeout} from 'node:timers/promises';
import {SyncWorkerDependencies} from './dependencies';
import {trainingSummaryEmail} from './training_summary_email';

const HEARTBEAT_INTERVAL_MS = 5 * 1000;
const EQUIPMENT_SYNC_CHECK_INTERVAL_MS = 60 * 1000;
const TRAINING_SUMMARY_EMAIL_CHECK_INTERVAL_MS = 20 * 60 * 1000;
const EQUIPMENT_SYNC_INTERVAL_MS = 20 * 60 * 1000;
const TROUBLE_TICKET_SYNC_INTERVAL_MS = 20 * 60 * 1000;
const RESYNC_INTERVAL_MS = 20 * 60 * 1000;

async function syncEquipmentTrainingSheetsPeriodically(
  deps: SyncWorkerDependencies,
  google: GoogleHelpers
): Promise<never> {
  let lastHeartbeat = Date.now();
  let lastEquipmentSyncCheck = Date.now();
  let lastTroubleTicketCheck = Date.now();
  let lastTrainingSummaryEmailCheck = Date.now();
  let lastResync = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const now = Date.now();
      const lastHeartbeatAgoMs = now - lastHeartbeat;
      const lastEquipmentSyncCheckAgoMs = now - lastEquipmentSyncCheck;
      const lastTroubleTicketCheckAgoMs = now - lastTroubleTicketCheck;
      const lastTrainingSummaryEmailCheckAgoMs =
        now - lastTrainingSummaryEmailCheck;
      const lastResyncAgoMs = now - lastResync;

      if (lastHeartbeatAgoMs > HEARTBEAT_INTERVAL_MS) {
        deps.logger.info(
          `Last Heartbeat ${lastHeartbeatAgoMs}ms ago, Last Sync ${lastEquipmentSyncCheckAgoMs}ms ago, Last Trouble Ticket ${lastTroubleTicketCheckAgoMs}ms ago`
        );
        lastHeartbeat = Date.now();
      }

      if (lastEquipmentSyncCheckAgoMs > EQUIPMENT_SYNC_CHECK_INTERVAL_MS) {
        await syncEquipmentTrainingSheets(
          deps,
          google,
          EQUIPMENT_SYNC_INTERVAL_MS
        );
        lastEquipmentSyncCheck = Date.now();
      }

      if (lastTroubleTicketCheckAgoMs > TROUBLE_TICKET_SYNC_INTERVAL_MS) {
        await syncTroubleTickets(
          deps,
          google,
          deps.conf.TROUBLE_TICKET_SHEET,
          TROUBLE_TICKET_SYNC_INTERVAL_MS
        );
        lastTroubleTicketCheck = Date.now();
      }

      if (lastResyncAgoMs > RESYNC_INTERVAL_MS) {
        // The background sync worker is expected to always be looking at slightly stale data.
        // If you need up to date data then use the events directly.
        await deps.sharedReadModel.asyncApplyExternalEventSources()();
        await deps.sharedReadModel.asyncRefresh()();
        lastResync = Date.now();
      }

      if (
        lastTrainingSummaryEmailCheckAgoMs >
        TRAINING_SUMMARY_EMAIL_CHECK_INTERVAL_MS
      ) {
        await trainingSummaryEmail(deps);
        lastTrainingSummaryEmailCheck = Date.now();
      }

      await setTimeout(1000);
    } catch (err) {
      deps.logger.error(err, 'Sync worker error');
    }
  }
}

async function run() {
  const deps = initDependencies();
  deps.logger.info(
    'Background sync worker ensuring sheet data tables exist...'
  );
  await deps.ensureGoogleDBTablesExist();
  deps.logger.info('All data tables exist, starting...');
  await syncEquipmentTrainingSheetsPeriodically(deps, deps.google);
}

run()
  .then(() => console.log('Background worker stopped'))
  .catch(console.error);
