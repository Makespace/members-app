import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  name: t.string,
});

type EditName = t.TypeOf<typeof codec>;

const process: Command<EditName>['process'] = input =>
  O.some(
    constructEvent('MemberDetailsUpdated')({
      memberNumber: input.command.memberNumber,
      name: input.command.name,
      formOfAddress: undefined,
      actor: input.command.actor,
    })
  );

const resource: Command<EditName>['resource'] = input => ({
  type: 'MemberDetails',
  id: input.memberNumber.toString(),
});

export const editName: Command<EditName> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
