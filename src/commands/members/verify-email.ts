import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import {Command} from '../command';
import {EmailAddressCodec, constructEvent} from '../../types';
import {projectMemberEmailStates} from './email-state';
import {normaliseEmailAddress} from '../../read-models/shared-state/normalise-email-address';

const codec = t.strict({
  memberNumber: t.number,
  email: EmailAddressCodec,
});

export type VerifyMemberEmail = t.TypeOf<typeof codec>;

const process: Command<VerifyMemberEmail>['process'] = input => {
  const state = projectMemberEmailStates(input.events).get(
    input.command.memberNumber
  );
  if (state === undefined) {
    return O.none;
  }

  const emailAddress = normaliseEmailAddress(input.command.email);
  const email = state.emails.get(emailAddress);
  if (email === undefined || email.verified) {
    return O.none;
  }

  return O.some(
    constructEvent('MemberEmailVerified')({
      actor: input.command.actor,
      memberNumber: input.command.memberNumber,
      email: input.command.email,
    })
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
  isAuthorized: ({actor}) => actor.tag === 'system',
};
