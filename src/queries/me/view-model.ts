import {Member, MemberDetails} from '../../types';

export type ViewModel = {
  member: Readonly<MemberDetails>;
  user: Readonly<Member>;
  isSelf: boolean;
};
