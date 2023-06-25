import {Config} from '../configuration';
import {Dependencies} from '../dependencies';
import {getMemberNumber} from './get-member-number';
import {getMemberNumberStubbed} from './get-member-number-stubbed';
import {createRateLimiter} from './rate-limit-sending-of-emails';
import {sendEmail} from './send-email';
import createLogger from 'pino';
import mysql from 'mysql';
import nodemailer from 'nodemailer';
import smtp from 'nodemailer-smtp-transport';

export const createAdapters = (conf: Config): Dependencies => {
  const logger = createLogger({
    formatters: {
      level: label => {
        return {severity: label};
      },
    },
  });

  const pool = mysql.createPool({
    host: conf.sql.host,
    database: conf.sql.database,
    user: conf.sql.user,
    password: conf.sql.password,
  });

  const emailTransporter = nodemailer.createTransport(
    smtp({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '2525'),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  );

  return {
    getMemberNumber: conf.useStubbedAdapters
      ? getMemberNumberStubbed()
      : getMemberNumber(pool),
    rateLimitSendingOfEmails: createRateLimiter(5, 24 * 3600),
    sendEmail: sendEmail(emailTransporter),
    logger,
  };
};
