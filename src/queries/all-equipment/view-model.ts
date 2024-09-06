import {User} from '../../types';

type Equipment = {
  id: string;
  name: string;
};

type Area = {
  name: string;
  id: string;
  equipment: ReadonlyArray<Equipment>;
};

export type ViewModel = {
  user: User;
  areas: ReadonlyArray<Area>;
};
