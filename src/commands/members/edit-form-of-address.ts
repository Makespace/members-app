import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import {isSelfOrPrivileged} from '../is-self-or-privileged';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  formOfAddress: t.string,
});

type EditFormOfAddress = t.TypeOf<typeof codec>;

const process: Command<EditFormOfAddress>['process'] = input =>
  O.some(
    constructEvent('MemberDetailsUpdated')({
      memberNumber: input.command.memberNumber,
      name: undefined,
      formOfAddress: input.command.formOfAddress,
    })
  );

const resource: Command<EditFormOfAddress>['resource'] = input => ({
  type: 'MemberDetails',
  id: input.memberNumber.toString(),
});

export const editFormOfAddress: Command<EditFormOfAddress> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isSelfOrPrivileged,
};
