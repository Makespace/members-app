import {Area, Owner} from '../../read-models/shared-state/return-types';
import {RecurlyReason} from '../../read-models/external-state/recurly-status';

// An owner decorated with this page's active/inactive verdict and, when
// inactive, the reason(s) behind it. `isActiveOwner` is computed in
// construct-view-model (past-due counts as inactive here); `reasons` is empty
// for active owners.
export type OwnerViewModel = Owner & {
  isActiveOwner: boolean;
  reasons: ReadonlyArray<RecurlyReason>;
};

export type AreaViewModel = Omit<Area, 'owners'> & {
  owners: ReadonlyArray<OwnerViewModel>;
};

export type ViewModel = {
  areas: ReadonlyArray<AreaViewModel>;
  canManageAreas: boolean;
  canSeeOwnerPrivateDetails: boolean;
};
