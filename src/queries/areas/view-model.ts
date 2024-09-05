import {User} from '../../types';

type Owner = {
  memberNumber: number;
};

type Area = {
  id: string;
  name: string;
  owners: ReadonlyArray<Owner>;
};

export type ViewModel = {
  user: User;
  areas: ReadonlyArray<Area>;
};
