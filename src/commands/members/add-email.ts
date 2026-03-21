import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {Command} from '../command';
import {EmailAddressCodec, constructEvent} from '../../types';
import {isSelfOrPrivileged} from '../is-self-or-privileged';
import {
  findMemberNumberByEmail,
  projectMemberEmailStates,
} from './email-state';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  email: EmailAddressCodec,
});

type AddMemberEmail = t.TypeOf<typeof codec>;

const process: Command<AddMemberEmail>['process'] = input => {
  const states = projectMemberEmailStates(input.events);
  const currentMember = states.get(input.command.memberNumber);
  if (currentMember === undefined) {
    return O.none;
  }

  const ownerOfEmail = findMemberNumberByEmail(states, input.command.email);
  if (ownerOfEmail === input.command.memberNumber) {
    return O.none;
  }
  if (ownerOfEmail !== undefined) {
    return O.some(
      constructEvent('LinkingMemberNumberToAnAlreadyUsedEmailAttempted')({
        actor: input.command.actor,
        memberNumber: input.command.memberNumber,
        email: input.command.email,
      })
    );
  }

  return O.some(
    constructEvent('MemberEmailAdded')({
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

export const addEmail: Command<AddMemberEmail> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isSelfOrPrivileged,
};
