import {MemberDetails, User} from '../../types';

export type ViewModel = {
  user: User;
  viewerIsSuperUser: boolean;
  members: ReadonlyArray<MemberDetails>;
};
