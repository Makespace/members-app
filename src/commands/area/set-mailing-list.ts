import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../command';
import {EmailAddressCodec} from '../../types/email-address';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  id: tt.UUID,
  email: t.string,
});

type SetMailingList = t.TypeOf<typeof codec>;

const process: Command<SetMailingList>['process'] = input => {
  return pipe(
    input.command.email,
    email => email === "" ? O.none : O.some(email),
    O.map(EmailAddressCodec.decode),
    O.getOrElseW(() => E.right(null)),
    O.fromEither,
    O.map(email => ({
      ...input.command,
      email,
    })),
    O.map(constructEvent('AreaEmailUpdated')),
    TE.right
  );
};

export const setMailingList: Command<SetMailingList> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
