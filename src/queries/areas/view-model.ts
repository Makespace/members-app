import {Area} from '../../read-models/areas';
import {User} from '../../types';

export type ViewModel = {
  user: User;
  isSuperUser: boolean;
  areas: ReadonlyArray<Area>;
};
