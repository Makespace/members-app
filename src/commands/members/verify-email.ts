import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {EmailAddressCodec, constructEvent} from '../../types';
import {projectMemberEmailStates} from './email-state';
import {normaliseEmailAddress} from '../../read-models/shared-state/normalise-email-address';
import { isAdminOrSuperUser } from '../is-admin-or-super-user';
import {failureWithStatus} from '../../types/failure-with-status';

const codec = t.strict({
  memberNumber: t.number,
  emailAddress: EmailAddressCodec,
});

type VerifyMemberEmail = t.TypeOf<typeof codec>;

const process: Command<VerifyMemberEmail>['process'] = input => {
  const state = projectMemberEmailStates(input.events).get(
    input.command.memberNumber
  );
  if (state === undefined) {
    return TE.left(
      failureWithStatus(
        'The email verification link is no longer valid',
        StatusCodes.BAD_REQUEST
      )()
    );
  }

  const emailAddress = normaliseEmailAddress(input.command.emailAddress);
  const email = state.emails[emailAddress];
  if (!email || email.verified) {
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
  isAuthorized: (args) => isAdminOrSuperUser(args),
};
