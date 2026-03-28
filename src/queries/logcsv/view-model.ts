import {StoredDomainEvent} from '../../types';

export type ViewModel = {
  events: ReadonlyArray<StoredDomainEvent>;
};
