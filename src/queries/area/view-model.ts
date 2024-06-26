import {Area} from '../../read-models/areas';
import {User} from '../../types';

export type ViewModel = {
  area: Area;
  user: User;
  isSuperUser: boolean;
  equipment: ReadonlyArray<{
    id: string;
    name: string;
  }>;
};
