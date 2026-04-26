import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {EmailAddressCodec, constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import { isSelfOrPrivileged } from '../authentication-helpers/is-self-or-privileged';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  email: EmailAddressCodec,
});

type AddMemberEmail = t.TypeOf<typeof codec>;

const process: Command<AddMemberEmail>['process'] = input => {
  const currentMember = input.rm.members.getByMemberNumber(
    input.command.memberNumber
  );
  if (O.isNone(currentMember)) {
    return TE.left(
      failureWithStatus(
        'The requested member does not exist',
        StatusCodes.NOT_FOUND
      )()
    );
  }

  const ownerOfEmail = input.rm.members.getByEmail(input.command.email, false);
  if (
    O.isSome(ownerOfEmail) &&
    ownerOfEmail.value.userId === currentMember.value.userId
  ) {
    return TE.right(O.none);
  }
  if (O.isSome(ownerOfEmail)) {
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

export const addEmail: Command<AddMemberEmail> = {
  process,
  decode: codec.decode,
  isAuthorized: isSelfOrPrivileged,
};
