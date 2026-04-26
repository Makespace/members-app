import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import { isSelfOrPrivileged } from '../authentication-helpers/is-self-or-privileged';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  formOfAddress: t.string,
});

type EditFormOfAddress = t.TypeOf<typeof codec>;

const process: Command<EditFormOfAddress>['process'] = input =>
  TE.right(
    O.some(
      constructEvent('MemberDetailsUpdated')({
        memberNumber: input.command.memberNumber,
        name: undefined,
        formOfAddress: input.command.formOfAddress,
        actor: input.command.actor,
      })
    )
  );

export const editFormOfAddress: Command<EditFormOfAddress> = {
  process,
  decode: codec.decode,
  isAuthorized: isSelfOrPrivileged,
};
