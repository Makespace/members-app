import {MemberDetails, User} from '../../types';

export type ViewModel = {
  user: User;
  members: ReadonlyArray<MemberDetails>;
};
