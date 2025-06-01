import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {resource} from './resource';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
});

export type DeclareSuperUserCommand = t.TypeOf<typeof codec>;

const process: Command<DeclareSuperUserCommand>['process'] = input =>
  O.some(constructEvent('SuperUserDeclared')(input.command));

export const declare: Command<DeclareSuperUserCommand> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
