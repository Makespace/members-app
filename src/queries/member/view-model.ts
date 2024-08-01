import {Member} from '../../read-models/members';
import {User} from '../../types';

export type ViewModel = {
  member: Readonly<Member>;
  user: Readonly<User>;
  isSelf: boolean;
};
