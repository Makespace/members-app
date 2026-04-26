import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  name: t.string,
});

type EditName = t.TypeOf<typeof codec>;

const process: Command<EditName>['process'] = input =>
  TE.right(
    O.some(
      constructEvent('MemberDetailsUpdated')({
        memberNumber: input.command.memberNumber,
        name: input.command.name,
        formOfAddress: undefined,
        actor: input.command.actor,
      })
    )
  );

export const editName: Command<EditName> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
