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
  USE_STUBBED_ADAPTERS: withDefaultIfEmpty(tt.BooleanFromString, false),
  EVENT_DB_URL: withDefaultIfEmpty(
    t.string,
    'file:/tmp/makespace-member-app.db'
  ),
  LOG_LEVEL: withDefaultIfEmpty(LogLevel, 'debug'),
  BACKGROUND_PROCESSING_ENABLED: withDefaultIfEmpty(
    tt.BooleanFromString,
    false
  ),
  GOOGLE_CONNECTIVITY_ENABLED: withDefaultIfEmpty(tt.BooleanFromString, false),
});
export type Config = t.TypeOf<typeof Config>;

const ConfigWithGoogle = t.intersection([
  Config,
  t.strict({
    GOOGLE_CONNECTIVITY_ENABLED: t.literal(true),
    GOOGLE_SERVICE_ACCOUNT_KEY_PROJECT_ID: t.string,
    GOOGLE_SERVICE_ACCOUNT_KEY_PRIVATE_KEY_ID: t.string,
    GOOGLE_SERVICE_ACCOUNT_KEY_PRIVATE_KEY: t.string,
    GOOGLE_SERVICE_ACCOUNT_KEY_CLIENT_EMAIL: t.string,
    GOOGLE_SERVICE_ACCOUNT_KEY_CLIENT_ID: t.string,
    GOOGLE_SERVICE_ACCOUNT_KEY_AUTH_URI: t.string,
    GOOGLE_SERVICE_ACCOUNT_KEY_TOKEN_URI: t.string,
    GOOGLE_SERVICE_ACCOUNT_KEY_AUTH_PROVIDER_X509_CERT_URL: t.string,
    GOOGLE_SERVICE_ACCOUNT_KEY_CLIENT_X509_CERT_URL: t.string,
    GOOGLE_SERVICE_ACCOUNT_KEY_UNIVERSE_DOMAIN: t.string,
  }),
]);
export type ConfigWithGoogle = t.TypeOf<typeof ConfigWithGoogle>;

const readCfg =
  <I, T>(codec: t.Decoder<I, T>) =>
  (input: I) =>
    pipe(
      input,
      codec.decode,
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

export const loadConfig = (): Config | ConfigWithGoogle =>
  pipe(readCfg(Config)(process.env), baseCfg =>
    baseCfg.GOOGLE_CONNECTIVITY_ENABLED
      ? readCfg(ConfigWithGoogle)({
          ...process.env,
          GOOGLE_CONNECTIVITY_ENABLED: true,
        })
      : baseCfg
  );
