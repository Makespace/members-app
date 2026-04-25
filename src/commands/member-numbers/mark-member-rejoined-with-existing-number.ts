import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  memberNumber: tt.IntFromString,
});

type MarkMemberRejoinedWithExistingNumber = t.TypeOf<typeof codec>;

const process: Command<MarkMemberRejoinedWithExistingNumber>['process'] =
  input =>
    TE.right(O.some(
      constructEvent('MemberRejoinedWithExistingNumber')(input.command)
    ));

const resource: Command<MarkMemberRejoinedWithExistingNumber>['resource'] =
  input => ({
    type: 'Member',
    id: input.memberNumber.toString(),
  });

export const markMemberRejoinedWithExistingNumber: Command<MarkMemberRejoinedWithExistingNumber> =
  {
    process,
    resource,
    decode: codec.decode,
    isAuthorized: isAdminOrSuperUser,
  };
