import {Area, Owner} from '../../read-models/shared-state/return-types';
import {RecurlyReason} from '../../read-models/external-state/recurly-status';
import {QuarterCount} from '../../read-models/shared-state/member/training-delivered';

// An owner decorated with this page's active/inactive verdict and, when
// inactive, the reason(s) behind it. `isActiveOwner` is computed in
// construct-view-model (past-due counts as inactive here); `reasons` is empty
// for active owners. `trainingsByQuarter` holds the trainings this owner has
// delivered, bucketed into the last few quarters for the sparkline.
export type OwnerViewModel = Owner & {
  isActiveOwner: boolean;
  reasons: ReadonlyArray<RecurlyReason>;
  trainingsByQuarter: ReadonlyArray<QuarterCount>;
};

export type AreaViewModel = Omit<Area, 'owners'> & {
  owners: ReadonlyArray<OwnerViewModel>;
};

export type ViewModel = {
  areas: ReadonlyArray<AreaViewModel>;
  canManageAreas: boolean;
  canSeeOwnerPrivateDetails: boolean;
};
