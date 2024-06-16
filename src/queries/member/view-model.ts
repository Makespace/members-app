import {MemberDetails} from '../../types';

export type ViewModel = {
  member: Readonly<MemberDetails>;
  isSelf: boolean;
};
