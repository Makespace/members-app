import {Config} from '../configuration';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../dependencies';
import {getMemberNumber} from './get-member-number';
import {getMemberNumberStubbed} from './get-member-number-stubbed';
import {createRateLimiter} from './rate-limit-sending-of-emails';
import {sendEmail} from './send-email';
import createLogger from 'pino';
import mysql from 'mysql';
import nodemailer from 'nodemailer';
import smtp from 'nodemailer-smtp-transport';
import {getTrainersStubbed} from './get-trainers-stubbed';
import {commitEvent} from './commit-event';

export const createAdapters = (conf: Config): Dependencies => {
  const logger = createLogger({
    formatters: {
      level: label => {
        return {severity: label};
      },
    },
  });

  const pool = mysql.createPool({
    host: conf.MYSQL_HOST,
    database: conf.MYSQL_DATABASE,
    user: conf.MYSQL_USER,
    password: conf.MYSQL_PASSWORD,
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
    commitEvent,
    getAllEvents: () => TE.right([]),
    getMemberNumber: conf.USE_STUBBED_ADAPTERS
      ? getMemberNumberStubbed()
      : getMemberNumber(pool),
    getTrainers: getTrainersStubbed(),
    rateLimitSendingOfEmails: createRateLimiter(5, 24 * 3600),
    sendEmail: sendEmail(emailTransporter),
    logger,
  };
};
