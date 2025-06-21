import {ensureDBTablesExist} from './google/ensure-sheet-data-tables-exist';

import {syncTroubleTickets} from './sync_trouble_ticket';
import {syncEquipmentTrainingSheets} from './sync_training_sheet';
import {initDependencies} from './init-dependencies';
import * as O from 'fp-ts/Option';

const EQUIPMENT_SYNC_INTERVAL_MS = 40 * 60 * 1000;

export async function run() {
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
  await ensureDBTablesExist(deps.db);
  deps.logger.info('All data tables exist, starting...');

  if (O.isSome(deps.google)) {
    const google = deps.google.value;
    setInterval(() => {
      syncEquipmentTrainingSheets(deps, google, EQUIPMENT_SYNC_INTERVAL_MS)
        .then(() => deps.logger.info('Equipment training sheet sync complete'))
        .catch(err =>
          deps.logger.error(err, 'Equipment training sheet sync error')
        );
    }, 20 * 60_000);
    const troubleTicketSheet = deps.conf.TROUBLE_TICKET_SHEET;
    if (troubleTicketSheet) {
      setInterval(() => {
        syncTroubleTickets(deps, google, troubleTicketSheet)
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
