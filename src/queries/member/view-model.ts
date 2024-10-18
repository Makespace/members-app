import {Member} from '../../read-models/shared-state/return-types';
import {User} from '../../types';

export type ViewModel = {
  member: Readonly<Member>;
  user: Readonly<User>;
  isSelf: boolean;
};
