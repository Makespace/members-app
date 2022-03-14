import * as t from 'io-ts';
import isEmail from 'validator/lib/isEmail';

type EmailAddressBrand = {
  readonly EmailAddress: unique symbol;
};

export const EmailAddressCodec = t.brand(
  t.string,
  (input): input is t.Branded<string, EmailAddressBrand> => isEmail(input),
  'EmailAddress'
);

export type EmailAddress = t.TypeOf<typeof EmailAddressCodec>;
