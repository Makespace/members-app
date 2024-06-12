import {User} from '../../types';

export type ViewModel = {
  user: User;
  equipment: {
    name: string;
    id: string;
    trainers: ReadonlyArray<number>;
  };
};
