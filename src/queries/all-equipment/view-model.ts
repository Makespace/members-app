import {UUID} from 'io-ts-types';
import {User} from '../../types';

type Equipment = {
  name: string;
  id: UUID;
  areaId: UUID;
  areaName: string;
};

export type ViewModel = {
  user: User;
  isSuperUser: boolean;
  equipment: ReadonlyArray<Equipment>;
};
