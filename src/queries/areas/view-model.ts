import {User} from '../../types';
import * as O from 'fp-ts/Option';

type Owner = {
  memberNumber: number;
  name: O.Option<string>;
  email: string;
  agreementSignedAt: Date | null;
};

type Equipment = {
  id: string;
  name: string;
};

type Area = {
  id: string;
  name: string;
  owners: ReadonlyArray<Owner>;
  equipment: ReadonlyArray<Equipment>;
};

export type ViewModel = {
  user: User;
  areas: ReadonlyArray<Area>;
};
