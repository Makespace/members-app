import {User} from './user';

export type Actor = {tag: 'user'; user: User} | {tag: 'token'; token: 'admin'};
