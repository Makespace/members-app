import {Config} from '../configuration';
import {Dependencies} from '../dependencies';
import {createRateLimiter} from './rate-limit-sending-of-emails';
import {sendEmail} from './send-email';
import * as O from 'fp-ts/Option';
import createLogger, {LoggerOptions} from 'pino';
import nodemailer from 'nodemailer';
import {commitEvent} from './event-store/commit-event';
import {getAllEvents, getAllEventsByType} from './event-store/get-all-events';
import {getResourceEvents} from './event-store/get-resource-events';
import {Client} from '@libsql/client';

import {initSharedReadModel} from '../read-models/shared-state';
import {lastSync} from '../sync-worker/db/last_sync';
import {getSheetData, getSheetDataByMemberNumber} from '../sync-worker/db/get_sheet_data';
import {getTroubleTicketData} from '../sync-worker/db/get_trouble_ticket_data';

export const initLogger = (conf: Config) => {
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
  return createLogger(loggerOptions);
};

export const initDependencies = (
  eventDB: Client,
  googleDB: Client,
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
    O.fromNullable(conf.RECURLY_TOKEN)
  );

  const deps: Dependencies = {
    commitEvent: commitEvent(eventDB, logger, sharedReadModel.asyncRefresh),
    getAllEvents: getAllEvents(eventDB),
    getAllEventsByType: getAllEventsByType(eventDB),
    getResourceEvents: getResourceEvents(eventDB),
    sharedReadModel,
    rateLimitSendingOfEmails: createRateLimiter(5, 24 * 3600),
    sendEmail: sendEmail(emailTransporter, conf.SMTP_FROM),
    logger,
    lastQuizSync: lastSync(googleDB),
    getSheetData: getSheetData(googleDB),
    getSheetDataByMemberNumber: getSheetDataByMemberNumber(googleDB),
    getTroubleTicketData: getTroubleTicketData(
      googleDB,
      O.fromNullable(conf.TROUBLE_TICKET_SHEET)
    ),
    // getPassedQuizResults: getPassedQuizResults(dbClient),
    // getFailedQuizResults: getFailedQuizResults(dbClient),
  };
  return deps;
};
