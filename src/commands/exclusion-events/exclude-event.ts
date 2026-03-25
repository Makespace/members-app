import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';

const codec = t.strict({
  event_id: tt.UUID
});

export type ExcludeEvent = t.TypeOf<typeof codec>;

const process: Command<ExcludeEvent>['process'] = async input => {
  
};

const resource = () => ({
  type: 'ExcludeEvent',
  id: 'ExcludeEvent',
});

export const excludeEvent: Command<ExcludeEvent> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
