import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {constructEvent} from '../../types';
import {pipe} from 'fp-ts/lib/function';
import { isSelfOrPrivileged } from '../authentication-helpers/is-self-or-privileged';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  signedAt: tt.DateFromISOString,
});

type SignOwnerAgreement = t.TypeOf<typeof codec>;

const process: Command<SignOwnerAgreement>['process'] = input =>
  pipe(input.command, constructEvent('OwnerAgreementSigned'), O.some, TE.right);

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
