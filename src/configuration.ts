import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {withDefaultIfEmpty} from './util';

export const SEND_EMAIL_VERIFICATION_COOLDOWN_MS = 10 * 60 * 1000;

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
  GOOGLE_DB_URL: withDefaultIfEmpty(
    t.string,
    'file:/google_db_data/makespace-member-app-google.db'
  ),
  TURSO_TOKEN: t.union([t.undefined, t.string]),
  TURSO_GOOGLE_DB_TOKEN: t.union([t.undefined, t.string]),
  RECURLY_TOKEN: t.union([t.undefined, t.string]),
  TURSO_EVENTDB_SYNC_URL: t.string,
  TURSO_GOOGLEDB_SYNC_URL: t.union([t.undefined, t.string]),
  LOG_LEVEL: withDefaultIfEmpty(LogLevel, 'debug'),
  GOOGLE_RATELIMIT_MS: withDefaultIfEmpty(
    tt.IntFromString,
    (30 * 60 * 1000) as t.Int
  ),
  GOOGLE_SERVICE_ACCOUNT_KEY_JSON: tt.NonEmptyString, // Don't default so we don't accidentally disable.
  TROUBLE_TICKET_SHEET: t.string,
  // The Workspace mailbox to import into the app ('' disables the import).
  // Authenticated EITHER by an authorized-user OAuth token for the mailbox
  // account (GMAIL_AUTHORIZED_USER_JSON, a Fly secret - preferred, narrowest
  // blast radius) OR by domain-wide delegation of gmail.readonly to the
  // service account.
  GMAIL_IMPORT_MAILBOX: tt.withFallback(t.string, ''),
  // An OAuth "authorized user" credential for the mailbox account itself:
  // {"type":"authorized_user","client_id":...,"client_secret":...,
  //  "refresh_token":...}. '' falls back to domain-wide delegation.
  GMAIL_AUTHORIZED_USER_JSON: tt.withFallback(t.string, ''),
  // When the interesting address is a GROUP (groups have no mailbox of their
  // own), the import authenticates as a member account and this filters the
  // import to mail addressed/delivered to the group. '' imports the whole
  // inbox.
  GMAIL_FILTER_TO_ADDRESS: tt.withFallback(t.string, ''),
  // Area whose owners may view the imported mailbox (super-users always can).
  // '' restricts the page to super-users only.
  MANAGEMENT_TEAM_AREA_ID: tt.withFallback(t.string, ''),
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
        (conf.TURSO_EVENTDB_SYNC_URL.startsWith('libsql') &&
          conf.TURSO_TOKEN !== undefined) ||
        !conf.TURSO_EVENTDB_SYNC_URL.startsWith('libsql'),
      () => 'TURSO_TOKEN is required if TURSO_EVENTDB_SYNC_URL is a libsql url'
    ),
    // E.filterOrElse(
    //   conf =>
    //     (conf.GOOGLE_DB_URL.startsWith('libsql') &&
    //       conf.TURSO_GOOGLE_DB_TOKEN !== undefined) ||
    //     !conf.GOOGLE_DB_URL.startsWith('libsql'),
    //   () => 'TURSO_GOOGLE_DB_TOKEN is required if GOOGLE_DB_URL is a libsql url'
    // ),
    E.getOrElseW(errors => {
      throw new Error(`Failed to parse configuration from ENV:\n${errors}`);
    })
  );
