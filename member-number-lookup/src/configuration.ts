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

const Config = t.strict({
  MYSQL_DATABASE: tt.NonEmptyString,
  MYSQL_HOST: tt.NonEmptyString,
  MYSQL_PASSWORD: tt.NonEmptyString,
  MYSQL_USER: tt.NonEmptyString,
  PORT: withDefaultIfEmpty(tt.IntFromString, 8080 as t.Int),
  SESSION_SECRET: tt.NonEmptyString,
  SMTP_HOST: tt.NonEmptyString,
  SMTP_PASSWORD: t.string,
  SMTP_PORT: withDefaultIfEmpty(tt.IntFromString, 2525 as t.Int),
  SMTP_USER: t.string,
  TOKEN_SECRET: tt.NonEmptyString,
  USE_STUBBED_ADAPTERS: withDefaultIfEmpty(tt.BooleanFromString, false),
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
