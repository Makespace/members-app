import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  fobId: tt.NumberFromString,
});

type RemoveFob = t.TypeOf<typeof codec>;

const process: Command<RemoveFob>['process'] = input => {
  const member = input.rm.members.getByMemberNumber(input.command.memberNumber);
  if (O.isNone(member)) {
    return TE.left(
      failureWithStatus(
        'The requested member does not exist',
        StatusCodes.NOT_FOUND
      )()
    );
  }

  if (!member.value.fobs.some(fob => fob.fobId === input.command.fobId)) {
    return TE.right(O.none);
  }

  return TE.right(
    O.some(
      constructEvent('MemberFobRemoved')({
        actor: input.command.actor,
        memberNumber: input.command.memberNumber,
        fobId: input.command.fobId,
      })
    )
  );
};

export const removeFob: Command<RemoveFob> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
