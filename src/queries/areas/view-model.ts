import {EmailAddress} from '../../types';
import {EquipmentCategory} from '../../types/equipment-category';
import {RecurlyReason} from '../../read-models/external-state/recurly-status';
import {QuarterCount} from '../../read-models/shared-state/member/training-delivered';
import {UUID} from 'io-ts-types';
import * as O from 'fp-ts/Option';

// Narrow view-model for the /areas page: only the fields the renderer reads,
// not the full Area/Equipment expansions. The full equipment/area read-model
// APIs remain available for pages that need expanded relationships (issue
// #414, deliverables C+D).

// `isActiveOwner` is computed in construct-view-model (past-due counts as
// inactive here); `reasons` is empty unless a super-user is viewing (the only
// viewer who sees the inactive-owners section). `trainingsByQuarter` holds the
// trainings this owner has delivered in this area, bucketed into the last four
// quarters - computed only when the viewer can see that column.
export type OwnerViewModel = {
  memberNumber: number;
  name: O.Option<string>;
  primaryEmailAddress: EmailAddress;
  agreementSigned: O.Option<Date>;
  isActiveOwner: boolean;
  reasons: ReadonlyArray<RecurlyReason>;
  trainingsByQuarter: ReadonlyArray<QuarterCount>;
};

export type EquipmentViewModel = {
  id: UUID;
  name: string;
  category: EquipmentCategory;
  trainingsByQuarter: ReadonlyArray<QuarterCount>;
};

export type AreaViewModel = {
  id: UUID;
  name: string;
  email: O.Option<EmailAddress>;
  owners: ReadonlyArray<OwnerViewModel>;
  equipment: ReadonlyArray<EquipmentViewModel>;
};

export type ViewModel = {
  areas: ReadonlyArray<AreaViewModel>;
  canManageAreas: boolean;
  canSeeOwnerPrivateDetails: boolean;
  canSeeTrainings: boolean;
};
