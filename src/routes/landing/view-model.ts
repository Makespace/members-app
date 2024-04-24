import {User} from '../../types';
import {Trainer} from '../../types/trainer';

export type ViewModel = {
  user: User;
  trainers: ReadonlyArray<Trainer>;
  isSuperUser: boolean;
};
