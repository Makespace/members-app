import {User} from './user';
import * as t from 'io-ts';

const Actor = t.union(
  [
    t.strict({tag: t.literal('user'), user: User}),
    t.strict({tag: t.literal('token'), token: t.literal('admin')}),
  ],
  'tag'
);

export type Actor = t.TypeOf<typeof Actor>;
