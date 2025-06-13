import * as libsqlClient from '@libsql/client';
import {loadConfig} from '../configuration';
import {initLogger} from '../init-dependencies/init-dependencies';
import {
  ensureSheetDataSyncMetadataTableExists,
  ensureSheetDataTableExists,
  ensureTroubleTicketDataTableExists,
} from '../init-dependencies/google/ensure-sheet-data-tables-exist';
import {GoogleAuth} from 'google-auth-library';
import {
  GoogleHelpers,
  pullGoogleSheetData,
  pullGoogleSheetDataMetadata,
} from '../init-dependencies/google/pull_sheet_data';
import {setTimeout} from 'node:timers/promises';

async function main() {
  const conf = loadConfig();
  const logger = initLogger(conf);
  logger.info('Background sync worker starting up...');
  const dbClient = libsqlClient.createClient({
    url: conf.EVENT_DB_URL,
    syncUrl: conf.TURSO_SYNC_URL,
    authToken: conf.TURSO_TOKEN,
  });

  let lastHeartbeat = Date.now();
  setInterval(() => {
    logger.info(
      `Background Sync Heartbeat, last ${Date.now() - lastHeartbeat}ms ago`
    );
    lastHeartbeat = Date.now();
  }, 20_000);

  logger.info('Background sync worker ensuring sheet data tables exist...');
  await Promise.all([
    ensureSheetDataTableExists(dbClient),
    ensureSheetDataSyncMetadataTableExists(dbClient),
    ensureTroubleTicketDataTableExists(dbClient),
  ]);

  let googleHelpers: GoogleHelpers;
  if (
    conf.GOOGLE_SERVICE_ACCOUNT_KEY_JSON.toLowerCase().trim() !== 'disabled'
  ) {
    const googleAuth = new GoogleAuth({
      // Google issues the credentials file and validates it.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      credentials: JSON.parse(conf.GOOGLE_SERVICE_ACCOUNT_KEY_JSON),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    googleHelpers = {
      pullGoogleSheetData: pullGoogleSheetData(googleAuth),
      pullGoogleSheetDataMetadata: pullGoogleSheetDataMetadata(googleAuth),
    };
  } else {
    logger.info('Background sync worker - google connectivity disabled');
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await setTimeout(600_000);
      logger.info('Background worker idle - google connectivity disabled');
    }
  }

  await asyncApplyGoogleEvents(
            logger,
            currentState,
            googleHelpers.value,
            updateState,
            googleRefreshIntervalMs,
            troubleTicketSheetId,
            cacheSheetData,
            cacheTroubleTicketData
          );
}

main()
  .then(() => console.log('Background sync worker exit'))
  .catch(err => {
    console.error('Background sync worker top level error');
    console.error(err);
  });
