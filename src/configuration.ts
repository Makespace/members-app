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
  // Who the trouble ticket notifications may actually be sent to, so the
  // stack can be deployed and watched before anybody's inbox is involved.
  // Unset means nobody; 'all' means everybody; otherwise a comma-separated
  // list of the only addresses that may be written to. See
  // trouble-tickets/notification-gate.
  TROUBLE_TICKET_NOTIFY_TO: withDefaultIfEmpty(t.string, ''),
  GOOGLE_DB_URL: withDefaultIfEmpty(
    t.string,
    'file:/google_db_data/makespace-member-app-google.db'
  ),
  TURSO_TOKEN: t.union([t.undefined, t.string]),
  TURSO_GOOGLE_DB_TOKEN: t.union([t.undefined, t.string]),
  RECURLY_TOKEN: t.union([t.undefined, t.string]),
  // How long a member can be behind before the outstanding-invoices page files
  // them under "remove fob access" and then "cancel membership". Trustees set
  // these, so they are tunable without a code change.
  BILLING_REMOVE_ACCESS_AFTER_DAYS: withDefaultIfEmpty(
    tt.IntFromString,
    14 as t.Int
  ),
  BILLING_CANCEL_AFTER_DAYS: withDefaultIfEmpty(tt.IntFromString, 60 as t.Int),
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
