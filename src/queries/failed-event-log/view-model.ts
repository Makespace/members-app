import {User} from '../../types';

export type ViewModel = {
  user: User;
  count: number;
  failures: ReadonlyArray<{
    error: string;
    eventType: string;
    payload: unknown;
  }>;
};
