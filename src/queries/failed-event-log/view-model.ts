import {User} from '../../types';

export type ViewModel = {
  user: User;
  count: number;
  failures: ReadonlyArray<{
    error: string;
    eventId: string;
    eventIndex: number;
    eventType: string;
    payload: unknown;
  }>;
};
