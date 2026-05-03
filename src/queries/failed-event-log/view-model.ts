import { Int } from 'io-ts';
import {User} from '../../types';
import { UUID } from 'io-ts-types';

export type ViewModel = {
  user: User;
  count: number;
  failures: ReadonlyArray<{
    error: string;
    eventType: string;
    payload: unknown;
  }>;
};
