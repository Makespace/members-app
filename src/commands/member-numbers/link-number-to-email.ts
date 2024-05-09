import {DomainEvent, EmailAddressCodec} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../../types/command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';

const codec = t.strict({
  email: EmailAddressCodec,
  memberNumber: tt.NumberFromString,
});

type LinkNumberToEmail = t.TypeOf<typeof codec>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
const process = (input: {
  command: LinkNumberToEmail;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> => O.none;

export const linkNumberToEmail: Command<LinkNumberToEmail> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
