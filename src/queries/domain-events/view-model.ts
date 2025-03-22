import {User} from '../../types';
import {EventName} from '../../types/domain-event';

export type ViewModel = {
  user: User;
  events: ReadonlyArray<{
    name: EventName;
    description: string;
  }>;
};
