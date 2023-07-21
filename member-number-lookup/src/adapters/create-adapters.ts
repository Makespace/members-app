import {Config} from '../configuration';
import * as t from 'io-ts';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../dependencies';
import {getMemberNumber} from './get-member-number';
import * as E from 'fp-ts/Either';
import {getMemberNumberStubbed} from './get-member-number-stubbed';
import {createRateLimiter} from './rate-limit-sending-of-emails';
import {sendEmail} from './send-email';
import createLogger from 'pino';
import nodemailer from 'nodemailer';
import smtp from 'nodemailer-smtp-transport';
import {getTrainersStubbed} from './get-trainers-stubbed';
import {commitEvent} from './commit-event';
import {QueryDatabase} from './query-database';
import {flow, pipe} from 'fp-ts/lib/function';
import {DomainEvent} from '../types';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import * as tt from 'io-ts-types';

export const createAdapters = (
  conf: Config,
  queryDatabase: QueryDatabase
): Dependencies => {
  const logger = createLogger({
    formatters: {
      level: label => {
        return {severity: label};
      },
    },
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

  const EventsFromDb = t.readonlyArray(
    t.strict({
      id: t.string,
      resource_id: t.string,
      resource_type: t.string,
      event_type: t.string,
      payload: t.string,
    })
  );

  return {
    commitEvent: commitEvent(queryDatabase),
    getAllEvents: () =>
      pipe(
        queryDatabase('SELECT * FROM events;', []),
        TE.chainEitherK(
          flow(
            EventsFromDb.decode,
            E.chain(
              E.traverseArray(raw =>
                pipe(
                  raw.payload,
                  tt.JsonFromString.decode,
                  E.chain(tt.JsonRecord.decode),
                  E.map(payload => ({
                    type: raw.event_type,
                    ...payload,
                  }))
                )
              )
            ),
            E.chain(t.readonlyArray(DomainEvent).decode),
            E.mapLeft(formatValidationErrors),
            E.mapLeft(
              failureWithStatus(
                'Failed to get events from DB',
                StatusCodes.INTERNAL_SERVER_ERROR
              )
            )
          )
        )
      ),
    getMemberNumber: conf.USE_STUBBED_ADAPTERS
      ? getMemberNumberStubbed()
      : getMemberNumber(queryDatabase),
    getTrainers: getTrainersStubbed(),
    rateLimitSendingOfEmails: createRateLimiter(5, 24 * 3600),
    sendEmail: sendEmail(emailTransporter),
    logger,
  };
};
