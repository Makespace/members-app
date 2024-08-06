import {Member} from '../members';

export type Equipment = {
  id: string;
  name: string;
  trainers: ReadonlyArray<Member>;
};
