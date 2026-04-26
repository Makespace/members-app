import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  oldMemberNumber: tt.IntFromString,
  newMemberNumber: tt.IntFromString,
});

export type MarkMemberRejoinedWithNewNumber = t.TypeOf<typeof codec>;

const process: Command<MarkMemberRejoinedWithNewNumber>['process'] = input => {
  const oldUserId = input.rm.members.findUserIdByMemberNumber(
    input.command.oldMemberNumber
  );
  const newUserId = input.rm.members.findUserIdByMemberNumber(
    input.command.newMemberNumber
  );

  return TE.right(
    O.isSome(oldUserId) &&
      O.isSome(newUserId) &&
      oldUserId.value === newUserId.value
      ? O.none
      : O.some(constructEvent('MemberRejoinedWithNewNumber')(input.command))
  );
};

const resource: Command<MarkMemberRejoinedWithNewNumber>['resource'] =
  input => ({
    type: 'Member',
    id: input.oldMemberNumber.toString(),
  });

export const markMemberRejoinedWithNewNumber: Command<MarkMemberRejoinedWithNewNumber> =
  {
    process,
    resource,
    decode: codec.decode,
    isAuthorized: isAdminOrSuperUser,
  };
