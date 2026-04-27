import {DeletedStoredDomainEvent, User} from '../../types';

export interface DeletedEventsSearch {
  offset: number;
  limit: number;
}

export type ViewModel = {
  user: User;
  count: number;
  search: DeletedEventsSearch;
  events: ReadonlyArray<DeletedStoredDomainEvent>;
};
