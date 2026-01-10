import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {EmailAddressCodec} from '../../types/email-address';

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
  );
};

const resource: Command<SetMailingList>['resource'] = (command: SetMailingList) => ({
  type: 'Area',
  id: command.id,
});

export const setMailingList: Command<SetMailingList> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};

