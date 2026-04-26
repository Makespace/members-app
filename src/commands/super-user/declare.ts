import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {resource} from './resource';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';
import { failureWithStatus } from '../../types/failure-with-status';
import { StatusCodes } from 'http-status-codes';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
});

export type DeclareSuperUserCommand = t.TypeOf<typeof codec>;

const process: Command<DeclareSuperUserCommand>['process'] = input => {
  const member = input.rm.members.getByMemberNumber(input.command.memberNumber);
  if (O.isNone(member)) {
    return TE.left(
      failureWithStatus(
        'The requested member does not exist',
        StatusCodes.NOT_FOUND
      )()
    );
  }
  if (member.value.isSuperUser) {
    return TE.right(O.none);
  }
  return TE.right(O.some(constructEvent('SuperUserDeclared')(input.command)));
}

export const declare: Command<DeclareSuperUserCommand> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
