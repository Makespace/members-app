import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';

const withDefaultIfEmpty = <C extends t.Any>(codec: C, ifEmpty: t.TypeOf<C>) =>
  tt.withValidate(codec, (input, context) =>
    pipe(
      tt.NonEmptyString.validate(input, context),
      E.orElse(() => t.success(String(ifEmpty))),
      E.chain(nonEmptyString => codec.validate(nonEmptyString, context))
    )
  );

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
  QUIZ_RESULT_REFRESH_COOLDOWN_MS: withDefaultIfEmpty(
    tt.IntFromString,
    (20 * 60 * 1000) as t.Int
  ),
  GOOGLE_SERVICE_ACCOUNT_KEY_JSON: tt.NonEmptyString,
  LEGACY_TRAINING_COMPLETE_SHEET: withDefaultIfEmpty(
    t.string,
    '1Do4CbGZ7ndvK0955nBOi1psn7jVxgvRZHhlsQbZR3_Y'
  ),
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
