import {User} from '../../types';

export interface FailedEventLogSearch {
  offset: number;
  limit: number;
}

export type ViewModel = {
  user: User;
  count: number;
  search: FailedEventLogSearch;
  failures: ReadonlyArray<{
    error: string;
    payload: unknown;
  }>;
};
