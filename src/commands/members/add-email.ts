import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {EmailAddressCodec, constructEvent} from '../../types';
import {
  findMemberNumberByEmail,
  projectMemberEmailStates,
} from './email-state';
import {failureWithStatus} from '../../types/failure-with-status';
import { isSelfOrPrivileged } from '../authentication-helpers/is-self-or-privileged';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  email: EmailAddressCodec,
});

type AddMemberEmail = t.TypeOf<typeof codec>;

const process: Command<AddMemberEmail>['process'] = input => {
  const states = projectMemberEmailStates(input.events);
  const currentMember = states.get(input.command.memberNumber);
  if (currentMember === undefined) {
    return TE.left(
      failureWithStatus(
        'The requested member does not exist',
        StatusCodes.NOT_FOUND
      )()
    );
  }

  const ownerOfEmail = findMemberNumberByEmail(states, input.command.email);
  if (ownerOfEmail === input.command.memberNumber) {
    return TE.right(O.none);
  }
  if (ownerOfEmail !== undefined) {
    return TE.right(
      O.some(
        constructEvent('LinkingMemberNumberToAnAlreadyUsedEmailAttempted')({
          actor: input.command.actor,
          memberNumber: input.command.memberNumber,
          email: input.command.email,
        })
      )
    );
  }

  return TE.right(
    O.some(
      constructEvent('MemberEmailAdded')({
        actor: input.command.actor,
        memberNumber: input.command.memberNumber,
        email: input.command.email,
      })
    )
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
