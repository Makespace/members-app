import * as t from 'io-ts';
import {EmailAddressCodec} from '.';

export const User = t.strict({
  emailAddress: EmailAddressCodec,
  primaryEmailAddress: EmailAddressCodec,
  memberNumber: t.number,
});

export type User = t.TypeOf<typeof User>;
