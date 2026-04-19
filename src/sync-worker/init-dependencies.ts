import {loadConfig} from '../configuration';
import {
  pullGoogleSheetData,
  pullGoogleSheetDataMetadata,
} from './google/pull_sheet_data';
import {initLogger} from '../init-dependencies/init-dependencies';
import {SyncWorkerDependencies} from './dependencies';
import {createClient, Client} from '@libsql/client';
import {GoogleAuth} from 'google-auth-library';
import {lastSync} from './db/last_sync';
import {storeSync} from './db/store_sync';
import {updateTrainingSheetCache} from './db/update_training_sheet_cache';
import {getTrainingSheetsToSync} from './db/get_training_sheets_to_sync';
import {updateTroubleTicketCache} from './db/update_trouble_ticket_cache';
import {ensureGoogleDBTablesExist} from './google/ensure-sheet-data-tables-exist';
import {sendEmail} from '../init-dependencies/send-email';
import nodemailer from 'nodemailer';
import {initSharedReadModel} from '../read-models/shared-state';
import * as O from 'fp-ts/Option';
import {getResourceEvents} from '../init-dependencies/event-store/get-resource-events';
import {commitEvent} from '../init-dependencies/event-store/commit-event';
import {getSheetData} from './db/get_sheet_data';
import {GoogleDB, initGoogleDB} from './google/db';

const initDBCommands = (googleDB: GoogleDB, eventDB: Client) => {
  return {
    lastSync: lastSync(googleDB),
    storeSync: storeSync(googleDB),
    updateTrainingSheetCache: updateTrainingSheetCache(googleDB),
    getTrainingSheetsToSync: getTrainingSheetsToSync(eventDB),
    updateTroubleTicketCache: updateTroubleTicketCache(googleDB),
    ensureGoogleDBTablesExist: ensureGoogleDBTablesExist(googleDB),
  };
};

export const initDependencies = (): SyncWorkerDependencies => {
  const conf = loadConfig();
  const logger = initLogger(conf);
  logger.info('Background sync worker starting up...');
  const eventDB = createClient({
    url: conf.TURSO_EVENTDB_SYNC_URL,
    authToken: conf.TURSO_TOKEN,
  });
  const googleDBClient = createClient({
    url: conf.GOOGLE_DB_URL,
    // syncUrl: conf.TURSO_GOOGLEDB_SYNC_URL,
    // authToken: conf.TURSO_GOOGLE_DB_TOKEN,
  });
  const googleDB = initGoogleDB(googleDBClient);

  const googleAuth = new GoogleAuth({
    // Google issues the credentials file and validates it.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    credentials: JSON.parse(conf.GOOGLE_SERVICE_ACCOUNT_KEY_JSON),
    clientOptions: {transporterOptions: {fetchImplementation: fetch}},
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const google = {
    pullGoogleSheetData: pullGoogleSheetData(googleAuth),
    pullGoogleSheetDataMetadata: pullGoogleSheetDataMetadata(googleAuth),
  };

  logger.info(
    'Setting up background SMTP connection for emails to %s:%s (TLS %s)',
    conf.SMTP_HOST,
    conf.SMTP_PORT,
    conf.SMTP_TLS
  );

  const emailTransporter = nodemailer.createTransport({
      host: conf.SMTP_HOST,
      port: conf.SMTP_PORT,
      auth: {
        user: conf.SMTP_USER,
        pass: conf.SMTP_PASSWORD,
      },
      requireTLS: conf.SMTP_TLS,
    }
  );

  const sharedReadModel = initSharedReadModel(
    eventDB,
    logger,
    O.fromNullable(conf.RECURLY_TOKEN)
  );

  return {
    conf,
    logger,
    google,
    sharedReadModel,
    sendEmail: sendEmail(emailTransporter, conf.SMTP_FROM),
    getResourceEvents: getResourceEvents(eventDB),
    lastQuizSync: lastSync(googleDB),
    getSheetData: getSheetData(googleDB),
    commitEvent: commitEvent(eventDB, logger, () => async () => {}),
    ...initDBCommands(googleDB, eventDB),
  };
};
