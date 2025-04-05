import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {withDefaultIfEmpty} from './util';

const LogLevel = t.keyof({
  trace: null,
  debug: null,
  info: null,
  warn: null,
  error: null,
  fatal: null,
  silent: null,
});

const Config = t.strict({
  ADMIN_API_BEARER_TOKEN: tt.NonEmptyString,
  PORT: withDefaultIfEmpty(tt.IntFromString, 8080 as t.Int),
  PUBLIC_URL: tt.NonEmptyString,
  SESSION_SECRET: tt.NonEmptyString,
  SMTP_FROM: withDefaultIfEmpty(t.string, 'do-not-reply@makespace.org'),
  SMTP_HOST: tt.NonEmptyString,
  SMTP_PASSWORD: t.string,
  SMTP_PORT: withDefaultIfEmpty(tt.IntFromString, 2525 as t.Int),
  SMTP_TLS: withDefaultIfEmpty(tt.BooleanFromString, true),
  SMTP_USER: t.string,
  TOKEN_SECRET: tt.NonEmptyString,
  EVENT_DB_URL: withDefaultIfEmpty(
    t.string,
    'file:/tmp/makespace-member-app.db'
  ),
  TURSO_TOKEN: t.union([t.undefined, t.string]),
  TURSO_SYNC_URL: t.union([t.undefined, t.string]),
  LOG_LEVEL: withDefaultIfEmpty(LogLevel, 'debug'),
  GOOGLE_RATELIMIT_MS: withDefaultIfEmpty(
    tt.IntFromString,
    (20 * 60 * 1000) as t.Int
  ),
  GOOGLE_SERVICE_ACCOUNT_KEY_JSON: tt.NonEmptyString, // Don't default so we don't accidentally disable.
  LEGACY_TRAINING_COMPLETE_SHEET: t.union([t.undefined, t.string]), // If not provided then don't do legacy import. Will be removed after legacy import working.
  TROUBLE_TICKET_SHEET: t.union([t.undefined, t.null, t.string]), // If not provided then trouble ticket sync is disabled.
});

export type Config = t.TypeOf<typeof Config>;

export const loadConfig = (): Config =>
  pipe(
    process.env,
    Config.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(formattedErrors => formattedErrors.join('\n')),
    E.filterOrElse(
      conf =>
        (conf.EVENT_DB_URL.startsWith('libsql') &&
          conf.TURSO_TOKEN !== undefined) ||
        !conf.EVENT_DB_URL.startsWith('libsql'),
      () => 'TURSO_TOKEN is required if EVENT_DB_URL is a libsql url'
    ),
    E.getOrElseW(errors => {
      throw new Error(`Failed to parse configuration from ENV:\n${errors}`);
    })
  );
