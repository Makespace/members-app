import {MemberDetails} from '../../types';

export type ViewModel = {
  viewerIsSuperUser: boolean;
  members: ReadonlyArray<MemberDetails>;
};
