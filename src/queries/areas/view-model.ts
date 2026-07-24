import * as O from 'fp-ts/Option';
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
  // Most recent training completed on this area's equipment, and how many
  // trainings happened this calendar month.
  lastTrainingAt: O.Option<Date>;
  trainingsThisMonth: number;
};

export type ViewModel = {
  // Areas the viewer owns (hidden when empty); then the remaining areas grouped
  // into physical areas and "systems".
  myAreas: ReadonlyArray<AreaViewModel>;
  makespaceAreas: ReadonlyArray<AreaViewModel>;
  systems: ReadonlyArray<AreaViewModel>;
  canManageAreas: boolean;
  canSeeOwnerPrivateDetails: boolean;
  canSeeTrainings: boolean;
};
