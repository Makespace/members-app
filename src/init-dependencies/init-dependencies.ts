import {Config} from '../configuration';
import {Dependencies} from '../dependencies';
import {createRateLimiter} from './rate-limit-sending-of-emails';
import {sendEmail} from './send-email';
import * as O from 'fp-ts/Option';
import createLogger, {LoggerOptions} from 'pino';
import nodemailer from 'nodemailer';
import smtp from 'nodemailer-smtp-transport';
import {commitEvent} from './event-store/commit-event';
import {getAllEvents, getAllEventsByType} from './event-store/get-all-events';
import {getResourceEvents} from './event-store/get-resource-events';
import {Client} from '@libsql/client';
import {
  GoogleHelpers,
  pullGoogleSheetData,
  pullGoogleSheetDataMetadata,
} from './google/pull_sheet_data';
import {initSharedReadModel} from '../read-models/shared-state';
import {GoogleAuth} from 'google-auth-library';
import {getCachedSheetData} from './google/get-cached-sheet-data';
import {cacheSheetData} from './google/cache-sheet-data';

export const initDependencies = (
  dbClient: Client,
  cacheClient: Client,
  conf: Config
): Dependencies => {
  let loggerOptions: LoggerOptions;
  loggerOptions = {
    formatters: {
      level: label => {
        return {severity: label};
      },
    },
    level: conf.LOG_LEVEL,
  };

  if (conf.PUBLIC_URL.includes('localhost')) {
    loggerOptions = {
      ...loggerOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          levelFirst: true,
          levelKey: 'severity',
          colorizeObjects: false,
        },
      },
    };
  }

  const logger = createLogger(loggerOptions);

  const emailTransporter = nodemailer.createTransport(
    smtp({
      host: conf.SMTP_HOST,
      port: conf.SMTP_PORT,
      auth: {
        user: conf.SMTP_USER,
        pass: conf.SMTP_PASSWORD,
      },
      requireTLS: conf.SMTP_TLS,
    })
  );

  let googleHelpers: O.Option<GoogleHelpers> = O.none;
  if (
    conf.GOOGLE_SERVICE_ACCOUNT_KEY_JSON.toLowerCase().trim() !== 'disabled'
  ) {
    const googleAuth = new GoogleAuth({
      // Google issues the credentials file and validates it.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      credentials: JSON.parse(conf.GOOGLE_SERVICE_ACCOUNT_KEY_JSON),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    googleHelpers = O.some({
      pullGoogleSheetData: pullGoogleSheetData(googleAuth),
      pullGoogleSheetDataMetadata: pullGoogleSheetDataMetadata(googleAuth),
    });
  }
  googleHelpers = O.none;

  const _cacheSheetData: Dependencies['cacheSheetData'] =
    cacheSheetData(cacheClient);
  const _cacheTroubleTicketData: Dependencies['cacheTroubleTicketData'] =
    cacheSheetData(cacheClient);

  const sharedReadModel = initSharedReadModel(
    dbClient,
    logger,
    googleHelpers,
    conf.GOOGLE_RATELIMIT_MS,
    O.fromNullable(conf.TROUBLE_TICKET_SHEET),
    _cacheSheetData,
    _cacheTroubleTicketData,
    O.fromNullable(conf.RECURLY_TOKEN)
  );

  const deps: Dependencies = {
    commitEvent: commitEvent(dbClient, logger, sharedReadModel.asyncRefresh),
    getAllEvents: getAllEvents(dbClient),
    getAllEventsByType: getAllEventsByType(dbClient),
    getResourceEvents: getResourceEvents(dbClient),
    sharedReadModel,
    rateLimitSendingOfEmails: createRateLimiter(5, 24 * 3600),
    sendEmail: sendEmail(emailTransporter, conf.SMTP_FROM),
    logger,
    getCachedSheetData: getCachedSheetData(dbClient),
    getCachedTroubleTicketData: getCachedSheetData(dbClient),
    cacheSheetData: _cacheSheetData,
    cacheTroubleTicketData: _cacheTroubleTicketData,
  };
  return deps;
};
