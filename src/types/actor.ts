import {User} from './user';
import * as t from 'io-ts';

export const UserActor = t.strict({tag: t.literal('user'), user: User});
export type UserActor = t.TypeOf<typeof UserActor>;

export const Actor = t.union(
  [
    UserActor,
    t.strict({tag: t.literal('token'), token: t.literal('admin')}),
    t.strict({tag: t.literal('system')}),
  ],
  'tag'
);

export type Actor = t.TypeOf<typeof Actor>;
