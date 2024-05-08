import {Config} from '../configuration';
import {Dependencies} from '../dependencies';
import {getMemberNumber} from './get-member-number';
import {getMemberNumberStubbed} from './get-member-number-stubbed';
import {createRateLimiter} from './rate-limit-sending-of-emails';
import {sendEmail} from './send-email';
import createLogger from 'pino';
import nodemailer from 'nodemailer';
import smtp from 'nodemailer-smtp-transport';
import {getTrainersStubbed} from './get-trainers-stubbed';
import {legacyCommitEvent} from './event-store/legacy-commit-event';
import {legacyGetAllEvents} from './event-store/legacy-get-all-events';
import {QueryMakespaceDatabase} from './query-database';
import {LegacyQueryEventsDatabase} from './event-store/legacy-query-events-database';

export const initDependencies = (
  conf: Config,
  queryMembersDatabase: QueryMakespaceDatabase,
  queryEventLogDatabase: LegacyQueryEventsDatabase
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
    commitEvent: legacyCommitEvent(queryEventLogDatabase),
    getAllEvents: legacyGetAllEvents(queryEventLogDatabase),
    getMemberNumber: conf.USE_STUBBED_ADAPTERS
      ? getMemberNumberStubbed()
      : getMemberNumber(queryMembersDatabase),
    getTrainers: getTrainersStubbed(),
    rateLimitSendingOfEmails: createRateLimiter(5, 24 * 3600),
    sendEmail: sendEmail(emailTransporter),
    logger,
  };
};
