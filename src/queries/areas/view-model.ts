import {User} from '../../types';

type Area = {
  name: string;
  description: string;
  owners: ReadonlyArray<number>;
  id: string;
};

export type ViewModel = {
  user: User;
  isSuperUser: boolean;
  areas: ReadonlyArray<Area>;
};
