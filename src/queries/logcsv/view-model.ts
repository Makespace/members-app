import type {StoredEventLogEntry} from '../../types/stored-event-log-entry';

export type ViewModel = {
  events: ReadonlyArray<StoredEventLogEntry>;
};
