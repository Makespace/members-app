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
  SMTP_HOST: tt.NonEmptyString,
  SMTP_PASSWORD: t.string,
  SMTP_PORT: withDefaultIfEmpty(tt.IntFromString, 2525 as t.Int),
  SMTP_USER: t.string,
  TOKEN_SECRET: tt.NonEmptyString,
  EVENT_DB_URL: withDefaultIfEmpty(
    t.string,
    'file:/tmp/makespace-member-app.db'
  ),
  LOG_LEVEL: withDefaultIfEmpty(LogLevel, 'debug'),
  BACKGROUND_PROCESSING_ENABLED: withDefaultIfEmpty(
    tt.BooleanFromString,
    false
  ),
  BACKGROUND_PROCESSING_RUN_INTERVAL_MS: withDefaultIfEmpty(
    tt.IntFromString,
    (30 * 60 * 1000) as t.Int
  ),
  GOOGLE_SERVICE_ACCOUNT_KEY_JSON: t.union([t.null, t.undefined, t.string]),
});

export type Config = t.TypeOf<typeof Config>;

export const loadConfig = (): Config =>
  pipe(
    process.env,
    Config.decode,
    E.getOrElseW(errors => {
      pipe(
        errors,
        formatValidationErrors,
        formattedErrors => formattedErrors.join('\n'),
        message => process.stderr.write(message)
      );
      throw new Error('Failed to parse configuration from ENV');
    })
  );
