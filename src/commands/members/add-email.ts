import {constructEvent, EmailAddressCodec} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import { isSelfOrPrivileged } from '../is-self-or-privileged';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  email: EmailAddressCodec,
});

type AddEmail = t.TypeOf<typeof codec>;

const process: Command<AddEmail>['process'] = input =>
  O.some(
    constructEvent('MemberEmailAdded')({
      memberNumber: input.command.memberNumber,
      newEmail: input.command.email,
      actor: input.command.actor,
    })
  );

const resource: Command<AddEmail>['resource'] = input => ({
  type: 'MemberDetails',
  id: input.memberNumber.toString(),
});

export const addEmail: Command<AddEmail> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isSelfOrPrivileged,
};
