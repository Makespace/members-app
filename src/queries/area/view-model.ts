import {UUID} from 'io-ts-types';
import {Area} from '../../read-models/areas';
import {User} from '../../types';

export type ViewModel = {
  area: Area;
  user: User;
  isSuperUser: boolean;
  equipment: ReadonlyArray<{
    id: UUID;
    name: string;
  }>;
};
