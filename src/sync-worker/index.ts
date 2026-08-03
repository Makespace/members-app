import {syncTroubleTickets} from './sync_trouble_ticket';
import {syncEquipmentTrainingSheets} from './sync_training_sheet';
import {runQuizMigration} from '../training-quiz/migrate';
import {initDependencies} from './init-dependencies';
import {GoogleHelpers} from './google/pull_sheet_data';
import {setTimeout} from 'node:timers/promises';
import {SyncWorkerDependencies} from './dependencies';
import {trainingSummaryEmail} from './training-summary/training_summary_email';
import { Duration } from 'luxon';

const HEARTBEAT_INTERVAL_MS = 20 * 1000;
const EQUIPMENT_SYNC_CHECK_INTERVAL_MS = 60 * 1000;
const TRAINING_SUMMARY_EMAIL_CHECK_INTERVAL_MS = 20 * 60 * 1000;
const EQUIPMENT_SYNC_INTERVAL_MS = 20 * 60 * 1000;
const TROUBLE_TICKET_SYNC_INTERVAL_MS = 20 * 60 * 1000;
const RECURLY_SYNC_INTERVAL_MS = 20 * 60 * 1000;

async function syncExternDataPeriodically(
  deps: SyncWorkerDependencies,
  google: GoogleHelpers
): Promise<never> {
  let lastHeartbeat = Date.now();
  let lastEquipmentSyncCheck = Date.now();
  let lastTroubleTicketCheck = Date.now();
  let lastTrainingSummaryEmailCheck = Date.now();
  while (true) {
    try {
      const now = Date.now();
      const lastHeartbeatAgoMs = now - lastHeartbeat;
      const lastEquipmentSyncCheckAgoMs = now - lastEquipmentSyncCheck;
      const lastTroubleTicketCheckAgoMs = now - lastTroubleTicketCheck;
      const lastTrainingSummaryEmailCheckAgoMs =
        now - lastTrainingSummaryEmailCheck;

      if (lastHeartbeatAgoMs > HEARTBEAT_INTERVAL_MS) {
        deps.logger.info(
          `Last Heartbeat ${lastHeartbeatAgoMs}ms ago, Last Sync ${lastEquipmentSyncCheckAgoMs}ms ago, Last Trouble Ticket ${lastTroubleTicketCheckAgoMs}ms ago, Last Training Summary Email Check ${lastTrainingSummaryEmailCheckAgoMs}ms ago`
        );
        lastHeartbeat = Date.now();
      }

      if (lastEquipmentSyncCheckAgoMs > EQUIPMENT_SYNC_CHECK_INTERVAL_MS) {
        await syncEquipmentTrainingSheets(
          deps,
          google,
          EQUIPMENT_SYNC_INTERVAL_MS
        );
        // Bring any newly-cached quiz completions into the event log (dedup by
        // rowHash, so already-imported rows are cheap no-ops). Refresh first so
        // the dedup sees the one-time backfill and events from earlier cycles.
        //
        // SAFETY: this appends completions at recordedAt = now, which is only
        // correct once the one-time historical backfill has run. Deploying this
        // before that backfill would claim every historical row's hash at now
        // and prevent it being woven in at its true completedAt. That ordering
        // is enforced by not merging this until the backfill is done.
        await deps.sharedReadModel.asyncRefresh()();
        await runQuizMigration(deps)();
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

      if (
        lastTrainingSummaryEmailCheckAgoMs >
        TRAINING_SUMMARY_EMAIL_CHECK_INTERVAL_MS
      ) {
        // The background sync worker is expected to always be looking at slightly stale data.
        // If you need up to date data then use the events directly.
        await deps.sharedReadModel.asyncRefresh()();
        await trainingSummaryEmail(deps);
        lastTrainingSummaryEmailCheck = Date.now();
      }

      await deps.pullRecurlyData(Duration.fromMillis(RECURLY_SYNC_INTERVAL_MS));

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
  await deps.ensureExtDBTablesExist();
  deps.logger.info('All data tables exist, starting...');
  await syncExternDataPeriodically(deps, deps.google);
}

run()
  .then(() => console.log('Background worker stopped'))
  .catch(console.error);
