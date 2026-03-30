import type {StoredEventLogEntry} from '../../types/stored-event-log-entry';
import {User} from '../../types';

export interface LogSearch {
  offset: number;
  limit: number;
}

export type ViewModel = {
  user: User;
  count: number;
  search: LogSearch;
  events: ReadonlyArray<StoredEventLogEntry>;
};
