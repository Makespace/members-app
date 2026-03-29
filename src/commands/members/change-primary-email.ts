import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {EmailAddressCodec, constructEvent} from '../../types';
import {isSelfOrPrivileged} from '../is-self-or-privileged';
import {projectMemberEmailStates} from './email-state';
import {normaliseEmailAddress} from '../../read-models/shared-state/normalise-email-address';
import {failureWithStatus} from '../../types/failure-with-status';

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
  if (!email.verified) {
    return TE.left(
      failureWithStatus(
        'The requested email address must be verified before it can be made primary',
        StatusCodes.BAD_REQUEST
      )()
    );
  }
  if (state.primaryEmailAddress === emailAddress) {
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
