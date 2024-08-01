import {Member} from '../../read-models/members';
import {User} from '../../types';

export type ViewModel = {
  user: User;
  members: ReadonlyArray<Member>;
};
