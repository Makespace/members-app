import {Config} from '../configuration';
import {Dependencies} from '../dependencies';
import {createRateLimiter} from './rate-limit-sending-of-emails';
import {sendEmail} from './send-email';
import createLogger, {LoggerOptions} from 'pino';
import nodemailer from 'nodemailer';
import smtp from 'nodemailer-smtp-transport';
import {commitEvent} from './event-store/commit-event';
import {getAllEvents, getAllEventsByType} from './event-store/get-all-events';
import {getResourceEvents} from './event-store/get-resource-events';
import {Client} from '@libsql/client';
import {pullGoogleSheetData} from './google/pull_sheet_data';
import {google} from 'googleapis';
import * as O from 'fp-ts/Option';
import {updateTrainingQuizResults} from '../training-sheets/training-sheets-worker';

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
      requireTLS: conf.SMTP_TLS,
    })
  );

  const deps: Dependencies = {
    commitEvent: commitEvent(dbClient, logger),
    getAllEvents: getAllEvents(dbClient, logger),
    getAllEventsByType: getAllEventsByType(dbClient, logger),
    getResourceEvents: getResourceEvents(dbClient),
    rateLimitSendingOfEmails: createRateLimiter(5, 24 * 3600),
    sendEmail: sendEmail(emailTransporter, conf.SMTP_FROM),
    logger,
    updateTrainingQuizResults: O.none,
    lastTrainingQuizResultRefresh: O.none,
    trainingQuizRefreshRunning: false,
  };

  if (conf.BACKGROUND_PROCESSING_ENABLED) {
    if (!conf.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
      throw new Error(
        'Background processing is enabled but google service account key not provided'
      );
    }
    const auth = new google.auth.GoogleAuth({
      // Google issues the credentials file and validates it.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      credentials: JSON.parse(conf.GOOGLE_SERVICE_ACCOUNT_KEY_JSON),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    deps.updateTrainingQuizResults = O.some(() =>
      updateTrainingQuizResults(
        pullGoogleSheetData(auth),
        deps,
        logger,
        conf.QUIZ_RESULT_REFRESH_COOLDOWN_MS
      )
    );
  }

  return deps;
};
