import {User} from '../../types';

export type ViewModel = {
  user: User;
  superUsers: ReadonlyArray<{
    memberNumber: number;
    since: Date;
  }>;
};
