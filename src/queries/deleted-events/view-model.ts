import {DeletedStoredDomainEvent, User} from '../../types';

export type ViewModel = {
  user: User;
  events: ReadonlyArray<DeletedStoredDomainEvent>;
};
