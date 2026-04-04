import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {resource} from './resource';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
});

export type DeclareSuperUserCommand = t.TypeOf<typeof codec>;

const process: Command<DeclareSuperUserCommand>['process'] = input =>
  TE.right(O.some(constructEvent('SuperUserDeclared')(input.command)));

export const declare: Command<DeclareSuperUserCommand> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
