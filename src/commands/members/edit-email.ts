import {EmailAddressCodec, constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import {isSelfOrPrivileged} from '../is-self-or-privileged';

// TODO - this should confirm the email is real via an email confirmation.

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  email: EmailAddressCodec,
});

type EditEmail = t.TypeOf<typeof codec>;

const process: Command<EditEmail>['process'] = input =>
  O.some(
    constructEvent('MemberEmailChanged')({
      memberNumber: input.command.memberNumber,
      newEmail: input.command.email,
    })
  );

const resource: Command<EditEmail>['resource'] = input => ({
  type: 'Member',
  id: input.memberNumber.toString(),
});

export const editEmail: Command<EditEmail> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isSelfOrPrivileged,
};
