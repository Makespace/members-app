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
  accessLevel: tt.NonEmptyString,
  paxtonName: tt.NonEmptyString,
});

type RecordFob = t.TypeOf<typeof codec>;

const process: Command<RecordFob>['process'] = input => {
  const member = input.rm.members.getByMemberNumber(input.command.memberNumber);
  if (O.isNone(member)) {
    return TE.left(
      failureWithStatus(
        'The requested member does not exist',
        StatusCodes.NOT_FOUND
      )()
    );
  }

  // Re-recording a fob exactly as it already is (as a repeated upload will)
  // is not a change worth an event.
  const unchanged = member.value.fobs.some(
    fob =>
      fob.fobId === input.command.fobId &&
      fob.accessLevel === input.command.accessLevel &&
      fob.paxtonName === input.command.paxtonName
  );
  if (unchanged) {
    return TE.right(O.none);
  }

  return TE.right(
    O.some(
      constructEvent('MemberFobRecorded')({
        actor: input.command.actor,
        memberNumber: input.command.memberNumber,
        fobId: input.command.fobId,
        accessLevel: input.command.accessLevel,
        paxtonName: input.command.paxtonName,
      })
    )
  );
};

export const recordFob: Command<RecordFob> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
