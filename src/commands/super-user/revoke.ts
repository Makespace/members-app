import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {pipe} from 'fp-ts/lib/function';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
});

type RevokeSuperUser = t.TypeOf<typeof codec>;

const process: Command<RevokeSuperUser>['process'] = input =>
  TE.right(
    pipe(
      input.rm.members.getByMemberNumber(input.command.memberNumber),
      O.filter(member => member.isSuperUser),
      O.map(() => constructEvent('SuperUserRevoked')(input.command))
    )
  );

export const revoke: Command<RevokeSuperUser> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
