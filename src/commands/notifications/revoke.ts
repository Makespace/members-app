import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  notificationId: tt.UUID,
});

type RevokeNotification = t.TypeOf<typeof codec>;

const process: Command<RevokeNotification>['process'] = input =>
  TE.right(
    O.some(constructEvent('NotificationRevoked')(input.command))
  );

export const revoke: Command<RevokeNotification> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
