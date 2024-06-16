import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import {isSelfOrPrivileged} from '../is-self-or-privileged';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  pronouns: t.string,
});

type EditName = t.TypeOf<typeof codec>;

const process: Command<EditName>['process'] = input =>
  O.some(
    constructEvent('MemberDetailsUpdated')({
      memberNumber: input.command.memberNumber,
      pronouns: input.command.pronouns,
      name: undefined,
    })
  );

const resource: Command<EditName>['resource'] = () => ({
  type: 'MemberNumberEmailPairings',
  id: 'MemberNumberEmailPairings',
});

export const editPronouns: Command<EditName> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isSelfOrPrivileged,
};
