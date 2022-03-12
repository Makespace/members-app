import * as t from 'io-ts';

type EmailBrand = {
  readonly Email: unique symbol;
};

export const EmailCodec = t.brand(
  t.string,
  (input): input is t.Branded<string, EmailBrand> => input !== '',
  'Email'
);

export type Email = t.TypeOf<typeof EmailCodec>;
