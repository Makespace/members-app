import {User} from '../../types';

type Area = {
  name: string;
  description: string;
};

export type ViewModel = {
  user: User;
  isSuperUser: boolean;
  areas: ReadonlyArray<Area>;
};
