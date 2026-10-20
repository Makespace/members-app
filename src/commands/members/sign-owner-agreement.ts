import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {constructEvent} from '../../types';
import {pipe} from 'fp-ts/lib/function';
import { isSelfOrPrivileged } from '../authentication-helpers/is-self-or-privileged';
import {canSign} from '../../owner-agreement/agreement';
import {currentAgreement} from '../../owner-agreement/versions';

// A form sends one pick as a string and several as an array.
const picks = t.union([t.string, t.readonlyArray(t.string)]);

const codec = t.intersection([
  t.strict({
    memberNumber: tt.NumberFromString,
    signedAt: tt.DateFromISOString,
  }),
  // The responsibilities picked while reading the agreement.
  t.partial({
    equipment: picks,
    area: picks,
  }),
]);

type SignOwnerAgreement = t.TypeOf<typeof codec>;

const asList = (value: string | ReadonlyArray<string> | undefined) =>
  ([] as ReadonlyArray<string>).concat(value ?? []);

// Signing is always for the current version of the agreement. Signing again
// while a term is running (not yet due for renewal) does nothing, so a double
// submit can't push the end of the term out by another six months.
const process: Command<SignOwnerAgreement>['process'] = input => {
  const member = input.rm.members.getByMemberNumber(
    input.command.memberNumber
  );
  if (
    O.isSome(member) &&
    !canSign(member.value.ownerAgreement, new Date())
  ) {
    return TE.right(O.none);
  }
  return pipe(
    {
      actor: input.command.actor,
      memberNumber: input.command.memberNumber,
      signedAt: input.command.signedAt,
      agreementVersion: currentAgreement.key,
      interestedIn: {
        equipment: asList(input.command.equipment),
        area: asList(input.command.area),
      },
    },
    constructEvent('OwnerAgreementSigned'),
    O.some,
    TE.right
  );
};

export const signOwnerAgreement: Command<SignOwnerAgreement> = {
  process,
  decode: codec.decode,
  isAuthorized: isSelfOrPrivileged,
};
