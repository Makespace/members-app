import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {Command} from '../command';
import {EmailAddressCodec, constructEvent} from '../../types';
import {isSelfOrPrivileged} from '../is-self-or-privileged';
import {projectMemberEmailStates} from './email-state';
import {normaliseEmailAddress} from '../../read-models/shared-state/normalise-email-address';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  email: EmailAddressCodec,
});

type ChangeMemberPrimaryEmail = t.TypeOf<typeof codec>;

const process: Command<ChangeMemberPrimaryEmail>['process'] = input => {
  const state = projectMemberEmailStates(input.events).get(
    input.command.memberNumber
  );
  if (state === undefined) {
    return O.none;
  }

  const emailAddress = normaliseEmailAddress(input.command.email);
  const email = state.emails.get(emailAddress);
  if (
    email === undefined ||
    !email.verified ||
    state.primaryEmailAddress === emailAddress
  ) {
    return O.none;
  }

  return O.some(
    constructEvent('MemberPrimaryEmailChanged')({
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

export const changePrimaryEmail: Command<ChangeMemberPrimaryEmail> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isSelfOrPrivileged,
};
