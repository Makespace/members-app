import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {EmailAddressCodec, constructEvent} from '../../types';
import {projectMemberEmailStates, SEND_EMAIL_VERIFICATION_COOLDOWN_MS} from './email-state';
import {normaliseEmailAddress} from '../../read-models/shared-state/normalise-email-address';
import { publish } from 'pubsub-js';
import {failureWithStatus} from '../../types/failure-with-status';
import { isSelfOrPrivileged } from '../authentication-helpers/is-self-or-privileged';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  email: EmailAddressCodec,
});

type SendMemberEmailVerification = t.TypeOf<typeof codec>;

const process: Command<SendMemberEmailVerification>['process'] = input => {
  const state = projectMemberEmailStates(input.events).get(
    input.command.memberNumber
  );
  if (state === undefined) {
    return TE.left(
      failureWithStatus(
        'The requested member does not exist',
        StatusCodes.NOT_FOUND
      )()
    );
  }

  const emailAddress = normaliseEmailAddress(input.command.email);
  const email = state.emails[emailAddress];
  if (!email) {
    return TE.left(
      failureWithStatus(
        'The requested email address is not attached to this member',
        StatusCodes.BAD_REQUEST
      )()
    );
  }
  if (email.verified) {
    return TE.right(O.none);
  }

  if (email.verificationLastSent) {
    const sinceLastMs = Date.now() - email.verificationLastSent.getTime();
    if (sinceLastMs < SEND_EMAIL_VERIFICATION_COOLDOWN_MS) {
      return TE.right(O.none);
    }
  }

  publish('send-email-verification', {
    memberNumber: input.command.memberNumber,

    // We use the emailAddress we actually matched rather than the email input
    // This prevents weirdness around the normalised vs raw address
    emailAddress, 
  });

  return TE.right(
    O.some(
      constructEvent('MemberEmailVerificationRequested')({
        actor: input.command.actor,
        memberNumber: input.command.memberNumber,
        email: emailAddress,
      })
    )
  );
};

const resource = () => ({
  type: 'MemberNumberEmailPairings',
  id: 'MemberNumberEmailPairings',
});

export const sendEmailVerification: Command<SendMemberEmailVerification> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isSelfOrPrivileged,
};
