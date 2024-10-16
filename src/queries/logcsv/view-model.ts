import {DomainEvent} from '../../types';

export type ViewModel = {
  events: ReadonlyArray<DomainEvent>;
};
