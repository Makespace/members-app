import {ScopeNode} from '../../trouble-tickets/notification-preferences';

export type ViewModel = {
  scopes: ReadonlyArray<ScopeNode>;
  // How many rules currently send anything, so the page can lead with what
  // somebody will actually receive.
  soundingCount: number;
  isOwner: boolean;
  isTrainer: boolean;
};
