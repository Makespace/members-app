import {UUID} from 'io-ts-types';

export type Area = {
  id: UUID;
  name: string;
  owners: number[];
};
