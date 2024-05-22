import {UUID} from 'io-ts-types';
import {User} from '../../types';

type Area = {
  name: string;
  description: string;
  owners: ReadonlyArray<number>;
  id: UUID;
};

export type ViewModel = {
  user: User;
  isSuperUser: boolean;
  areas: ReadonlyArray<Area>;
};
