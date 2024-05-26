import {User} from '../../types';

type Equipment = {
  name: string;
  id: string;
  areaId: string;
  areaName: string;
};

export type ViewModel = {
  user: User;
  isSuperUser: boolean;
  equipment: ReadonlyArray<Equipment>;
};
