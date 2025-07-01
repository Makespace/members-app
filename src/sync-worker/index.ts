import {syncTroubleTickets} from './sync_trouble_ticket';
import {syncEquipmentTrainingSheets} from './sync_training_sheet';
import {initDependencies} from './init-dependencies';
import * as O from 'fp-ts/Option';
import {GoogleHelpers} from './google/pull_sheet_data';
import {setTimeout} from 'node:timers/promises';
import {SyncWorkerDependencies} from './dependencies';

const EQUIPMENT_SYNC_INTERVAL_MS = 20 * 60 * 1000;
const TROUBLE_TICKET_SYNC_INTERVAL_MS = 20 * 60 * 1000;

async function syncEquipmentTrainingSheetsPeriodically(
  deps: SyncWorkerDependencies,
  google: GoogleHelpers
) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await setTimeout(60_000);
      await syncEquipmentTrainingSheets(
        deps,
        google,
        EQUIPMENT_SYNC_INTERVAL_MS
      );
    } catch (err) {
      deps.logger.error(err, 'Equipment training sheet error');
    }
  }
}

async function run() {
  const deps = initDependencies();
  deps.logger.info('Background sync worker starting up...');

  let lastHeartbeat = Date.now();
  setInterval(() => {
    deps.logger.info(
      `Background Sync Heartbeat, last ${Date.now() - lastHeartbeat}ms ago`
    );
    lastHeartbeat = Date.now();
  }, 5000);

  deps.logger.info(
    'Background sync worker ensuring sheet data tables exist...'
  );
  await deps.ensureGoogleDBTablesExist();
  deps.logger.info('All data tables exist, starting...');

  if (O.isSome(deps.google)) {
    const google = deps.google.value;
    syncEquipmentTrainingSheetsPeriodically(deps, google)
      .then(() =>
        deps.logger.info('Equipment training sheet periodic sync stopped')
      )
      .catch(err =>
        deps.logger.error(
          err,
          'Equipment training sheet top level error - sync stopped'
        )
      );
    const troubleTicketSheet = deps.conf.TROUBLE_TICKET_SHEET;
    if (troubleTicketSheet) {
      setInterval(() => {
        syncTroubleTickets(
          deps,
          google,
          troubleTicketSheet,
          TROUBLE_TICKET_SYNC_INTERVAL_MS
        )
          .then(() => deps.logger.info('Trouble ticket sync complete'))
          .catch(err => deps.logger.error(err, 'Trouble ticket sync error'));
      }, 20 * 60_000);
    } else {
      deps.logger.info('No trouble ticket sheet provided. Not syncing');
    }
  } else {
    deps.logger.info('Background sync worker - google connectivity disabled');
  }
}

run()
  .then(() => console.log('Background worker stopped'))
  .catch(console.error);
