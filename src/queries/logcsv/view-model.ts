import {StoredDomainEventWithDeletion} from '../../types';

export type ViewModel = {
  events: ReadonlyArray<StoredDomainEventWithDeletion>;
};
