import {MemberDetails} from '../../types';

export type ViewModel = {
  member: Readonly<MemberDetails>;
  loggedInMember: Readonly<MemberDetails>;
  isSelf: boolean;
};
