import {Config} from '../configuration';
import {Dependencies} from '../dependencies';
import {createRateLimiter} from './rate-limit-sending-of-emails';
import {sendEmail} from './send-email';
import createLogger from 'pino';
import nodemailer from 'nodemailer';
import smtp from 'nodemailer-smtp-transport';
import {getTrainersStubbed} from './get-trainers-stubbed';
import {QueryEventsDatabase} from './event-store/query-events-database';
import {commitEvent} from './event-store/commit-event';
import {getAllEvents} from './event-store/get-all-events';

export const initDependencies = (
  conf: Config,
  queryEventLogDatabase: QueryEventsDatabase
): Dependencies => {
  const logger = createLogger({
    formatters: {
      level: label => {
        return {severity: label};
      },
    },
    level: 'debug',
  });

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

  return {
    commitEvent: commitEvent(queryEventLogDatabase),
    getAllEvents: getAllEvents(queryEventLogDatabase),
    getTrainers: getTrainersStubbed(),
    rateLimitSendingOfEmails: createRateLimiter(5, 24 * 3600),
    sendEmail: sendEmail(emailTransporter),
    logger,
  };
};
