import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {EmailAddressCodec, constructEvent} from '../../types';
import {normaliseEmailAddress} from '../../read-models/shared-state/normalise-email-address';
import {failureWithStatus} from '../../types/failure-with-status';
import { isSelfOrPrivileged } from '../authentication-helpers/is-self-or-privileged';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  email: EmailAddressCodec,
});

type ChangeMemberPrimaryEmail = t.TypeOf<typeof codec>;

const process: Command<ChangeMemberPrimaryEmail>['process'] = input => {
  const member = input.rm.members.getByMemberNumber(
    input.command.memberNumber
  );
  if (O.isNone(member)) {
    return TE.left(
      failureWithStatus(
        'Invalid request',
        StatusCodes.BAD_REQUEST
      )()
    );
  }

  const emailAddress = normaliseEmailAddress(input.command.email);
  const email = member.value.emails.find(
    currentEmail => currentEmail.emailAddress === emailAddress
  );
  if (
    !email ||
    O.isNone(email.verifiedAt)
  ) {
    return TE.left(
      failureWithStatus(
        'Invalid request',
        StatusCodes.BAD_REQUEST
      )()
    );
  }

  if (member.value.primaryEmailAddress === emailAddress) {
    return TE.right(O.none);
  }

  return TE.right(
    O.some(
      constructEvent('MemberPrimaryEmailChanged')({
        actor: input.command.actor,
        memberNumber: input.command.memberNumber,
        email: input.command.email,
      })
    )
  );
};

export const changePrimaryEmail: Command<ChangeMemberPrimaryEmail> = {
  process,
  decode: codec.decode,
  isAuthorized: isSelfOrPrivileged,
};
