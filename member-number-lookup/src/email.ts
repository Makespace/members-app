import * as t from 'io-ts';
import isEmail from 'validator/lib/isEmail';

type EmailBrand = {
  readonly Email: unique symbol;
};

export const EmailCodec = t.brand(
  t.string,
  (input): input is t.Branded<string, EmailBrand> => isEmail(input),
  'Email'
);

export type Email = t.TypeOf<typeof EmailCodec>;
