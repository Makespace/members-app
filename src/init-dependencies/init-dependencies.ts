import * as O from 'fp-ts/Option';
import {Config, ConfigWithGoogle} from '../configuration';
import {Dependencies} from '../dependencies';
import {createRateLimiter} from './rate-limit-sending-of-emails';
import {sendEmail} from './send-email';
import createLogger, {LoggerOptions} from 'pino';
import nodemailer from 'nodemailer';
import smtp from 'nodemailer-smtp-transport';
import {commitEvent} from './event-store/commit-event';
import {getAllEvents, getAllEventsByType} from './event-store/get-all-events';
import {getResourceEvents} from './event-store/get-resource-events';
import {Client} from '@libsql/client/.';
import {pullGoogleSheetData} from './google/pull_sheet_data';
import {google} from 'googleapis';

export const setupGoogleAuth = (conf: ConfigWithGoogle) => {
  return O.some(
    new google.auth.GoogleAuth({
      credentials: {
        client_email: conf.GOOGLE_SERVICE_ACCOUNT_KEY_CLIENT_EMAIL,
        private_key: conf.GOOGLE_SERVICE_ACCOUNT_KEY_PRIVATE_KEY,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
  );
};

export const initDependencies = (
  dbClient: Client,
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
    })
  );

  if (conf.GOOGLE_CONNECTIVITY_ENABLED) {
    conf = conf as ConfigWithGoogle;
  }

  const auth = conf.GOOGLE_CONNECTIVITY_ENABLED
    ? setupGoogleAuth(conf as ConfigWithGoogle)
    : O.none;

  return {
    commitEvent: commitEvent(dbClient, logger),
    getAllEvents: getAllEvents(dbClient),
    getAllEventsByType: getAllEventsByType(dbClient),
    getResourceEvents: getResourceEvents(dbClient),
    rateLimitSendingOfEmails: createRateLimiter(5, 24 * 3600),
    sendEmail: sendEmail(emailTransporter),
    pullGoogleSheetData: pullGoogleSheetData(auth),
    logger,
  };
};
