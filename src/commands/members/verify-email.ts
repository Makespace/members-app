import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {EmailAddressCodec, constructEvent} from '../../types';
import {normaliseEmailAddress} from '../../read-models/shared-state/normalise-email-address';
import {failureWithStatus} from '../../types/failure-with-status';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  memberNumber: t.number,
  emailAddress: EmailAddressCodec,
});

type VerifyMemberEmail = t.TypeOf<typeof codec>;

const process: Command<VerifyMemberEmail>['process'] = input => {
  const member = input.rm.members.getByMemberNumber(
    input.command.memberNumber
  );
  if (O.isNone(member)) {
    return TE.left(
      failureWithStatus(
        'The email verification link is no longer valid',
        StatusCodes.BAD_REQUEST
      )()
    );
  }

  const emailAddress = normaliseEmailAddress(input.command.emailAddress);
  const email = member.value.emails.find(
    currentEmail => currentEmail.emailAddress === emailAddress
  );
  if (!email || O.isSome(email.verifiedAt)) {
    return TE.left(
      failureWithStatus(
        'The email verification link is no longer valid',
        StatusCodes.BAD_REQUEST
      )()
    );
  }

  return TE.right(
    O.some(
      constructEvent('MemberEmailVerified')({
        actor: input.command.actor,
        memberNumber: input.command.memberNumber,
        email: input.command.emailAddress,
      })
    )
  );
};

const resource = () => ({
  type: 'MemberNumberEmailPairings',
  id: 'MemberNumberEmailPairings',
});

export const verifyEmail: Command<VerifyMemberEmail> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
