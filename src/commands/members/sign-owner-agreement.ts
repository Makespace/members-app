/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import {isSelfOrPrivileged} from '../is-self-or-privileged';
import {constructEvent} from '../../types';
import {pipe} from 'fp-ts/lib/function';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  signedAt: tt.DateFromISOString,
});

type SignOwnerAgreement = t.TypeOf<typeof codec>;

const process: Command<SignOwnerAgreement>['process'] = input =>
  pipe(input.command, constructEvent('OwnerAgreementSigned'), O.some);

const resource: Command<SignOwnerAgreement>['resource'] = input => ({
  type: 'OwnerAgreementSigning',
  id: input.memberNumber.toString(),
});

export const signOwnerAgreement: Command<SignOwnerAgreement> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isSelfOrPrivileged,
};
