import {Config} from '../configuration';
import {Dependencies} from '../dependencies';
import {createRateLimiter} from './rate-limit-sending-of-emails';
import {sendEmail} from './send-email';
import createLogger, {DestinationStream, LoggerOptions} from 'pino';
import nodemailer from 'nodemailer';
import {commitEvent} from './event-store/commit-event';
import {
  getAllEvents,
  getAllEventsByType,
  getDeletedEventByIndex,
  getDeletedEvents,
  getEventByIndex,
} from './event-store/get-all-events';
import {Client} from '@libsql/client';
import {deleteEvent, unDeleteEvent} from './event-store/set-event-deleted-state';
import {rebuildEventTimeline} from '../training-quiz/rebuild-event-timeline';

import {initSharedReadModel} from '../read-models/shared-state';
import {lastSync} from '../sync-worker/db/last_sync';
import {getSheetData, getSheetDataByMemberNumber} from '../sync-worker/db/get_sheet_data';
import { initExternalStateDB } from '../sync-worker/external-state-db';

// pino-http logs every request's headers at debug, and production logs at
// debug, on to Sentry Logs too: without this the bearer tokens (the admin
// API's, and the one every e-ink display sends once a minute) and members'
// session cookies would sit in the logs. Redacted here, before any transport.
const redact = {
  paths: ['req.headers.authorization', 'req.headers.cookie'],
  censor: '[redacted]',
};

// `destination` is for tests; the pino-pretty transport (localhost) ignores it.
export const initLogger = (conf: Config, destination?: DestinationStream) => {
  let loggerOptions: LoggerOptions;
  loggerOptions = {
    formatters: {
      level: label => {
        return {severity: label};
      },
    },
    level: conf.LOG_LEVEL,
    redact,
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
  return destination
    ? createLogger(loggerOptions, destination)
    : createLogger(loggerOptions);
};

export const initDependencies = (
  eventDB: Client,
  extDBClient: Client,
  conf: Config
): Dependencies => {
  const logger = initLogger(conf);

  const emailTransporter = nodemailer.createTransport(
    {
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
  );
  const extDB = initExternalStateDB(extDBClient);

  const deps: Dependencies = {
    conf,
    commitEvent: commitEvent(eventDB, logger, sharedReadModel.asyncRefresh),
    getAllEvents: getAllEvents(eventDB),
    getEventByIndex: getEventByIndex(eventDB),
    getDeletedEvents: getDeletedEvents(eventDB),
    getDeletedEventByIndex: getDeletedEventByIndex(eventDB),
    getAllEventsByType: getAllEventsByType(eventDB),
    deleteEvent: deleteEvent(eventDB, sharedReadModel.reset),
    unDeleteEvent: unDeleteEvent(eventDB, sharedReadModel.reset),
    rebuildEventTimeline: rebuildEventTimeline(eventDB, sharedReadModel.reset),
    sharedReadModel,
    extDB,
    rateLimitSendingOfEmails: createRateLimiter(5, 24 * 3600),
    sendEmail: sendEmail(emailTransporter, conf.SMTP_FROM),
    logger,
    lastQuizSync: lastSync(extDB),
    getSheetData: getSheetData(extDB),
    getSheetDataByMemberNumber: getSheetDataByMemberNumber(extDB),
    // getPassedQuizResults: getPassedQuizResults(dbClient),
    // getFailedQuizResults: getFailedQuizResults(dbClient),
  };
  return deps;
};
