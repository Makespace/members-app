import {loadConfig} from '../configuration';
import {
  GoogleHelpers,
  pullGoogleSheetData,
  pullGoogleSheetDataMetadata,
} from './google/pull_sheet_data';
import {initLogger} from '../init-dependencies/init-dependencies';
import {SyncWorkerDependencies} from './dependencies';
import {createClient, Client} from '@libsql/client';
import * as O from 'fp-ts/Option';
import {GoogleAuth} from 'google-auth-library';
import {lastSync} from './db/last_sync';
import {storeSync} from './db/store_sync';
import {lastTrainingSheetRowRead} from './db/last_training_sheet_row_read';
import {storeTrainingSheetRowsRead} from './db/store_training_sheet_rows_read';
import {clearTrainingSheetCache} from './db/clear_training_sheet_cache';
import {getTrainingSheetsToSync} from './db/get_training_sheets_to_sync';
import {storeTroubleTicketRowsRead} from './db/store_trouble_ticket_rows_read';
import {lastTroubleTicketRowRead} from './db/last_trouble_ticket_row_read';
import {clearTroubleTicketCache} from './db/clear_trouble_ticket_cache';
import {Logger} from 'pino';
import {ensureGoogleDBTablesExist} from './google/ensure-sheet-data-tables-exist';

const initDBCommands = (googleDB: Client, eventDB: Client, logger: Logger) => {
  return {
    lastSync: lastSync(googleDB),
    storeSync: storeSync(googleDB),
    lastTrainingSheetRowRead: lastTrainingSheetRowRead(googleDB),
    storeTrainingSheetRowsRead: storeTrainingSheetRowsRead(googleDB, logger),
    clearTrainingSheetCache: clearTrainingSheetCache(googleDB),
    getTrainingSheetsToSync: getTrainingSheetsToSync(eventDB),
    storeTroubleTicketRowsRead: storeTroubleTicketRowsRead(googleDB),
    lastTroubleTicketRowRead: lastTroubleTicketRowRead(googleDB),
    clearTroubleTicketCache: clearTroubleTicketCache(googleDB),
    ensureGoogleDBTablesExist: ensureGoogleDBTablesExist(googleDB),
  };
};

export const initDependencies = (): SyncWorkerDependencies => {
  const conf = loadConfig();
  const logger = initLogger(conf);
  logger.info('Background sync worker starting up...');
  const eventDB = createClient({
    url: conf.EVENT_DB_URL,
    syncUrl: conf.TURSO_EVENTDB_SYNC_URL,
    authToken: conf.TURSO_TOKEN,
  });
  const googleDB = createClient({
    url: conf.GOOGLE_DB_URL,
    syncUrl: conf.TURSO_GOOGLEDB_SYNC_URL,
    authToken: conf.TURSO_TOKEN,
  });

  let google: O.Option<GoogleHelpers> = O.none;
  if (
    conf.GOOGLE_SERVICE_ACCOUNT_KEY_JSON.toLowerCase().trim() !== 'disabled'
  ) {
    const googleAuth = new GoogleAuth({
      // Google issues the credentials file and validates it.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      credentials: JSON.parse(conf.GOOGLE_SERVICE_ACCOUNT_KEY_JSON),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    google = O.some({
      pullGoogleSheetData: pullGoogleSheetData(googleAuth),
      pullGoogleSheetDataMetadata: pullGoogleSheetDataMetadata(googleAuth),
    });
  }
  return {
    conf,
    logger,
    google,
    ...initDBCommands(googleDB, eventDB, logger),
  };
};
