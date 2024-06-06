import {DomainEvent, User} from '../../types';

export type ViewModel = {
  user: User;
  events: ReadonlyArray<DomainEvent>;
};
