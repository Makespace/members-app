import {SignedOwnerAgreement} from '../../owner-agreement/agreement';
import {Purchase} from '../../purchasing/purchases';
import {Proposal} from '../../purchasing/proposal';
import {EquipmentCategory} from '../../types/equipment-category';
import * as O from 'fp-ts/Option';
import {Actor, EmailAddress, GravatarHash, UserId} from '../../types';
import {UUID} from 'io-ts-types';
import {
  PurchaseApproval,
  PurchaseRequestOutcome,
} from '../../types/purchase-request-outcome';
import {RecordedSpendKind} from '../../types/recorded-spend-kind';
import {PurchaseRequestStatus} from '../../types/purchase-request-status';

export type TrainedMember = Pick<
  MemberCoreInfo,
  'name' | 'memberNumber' | 'primaryEmailAddress' | 'pastMemberNumbers'
> & {
  markedTrainedByActor: O.Option<Actor>;
  trainedByMemberNumber: O.Option<number>;
  trainedByEmail: O.Option<EmailAddress>;
  trainedSince: Date;
  legacyImport: boolean;
};

export type TrainerInfo = Pick<
  MemberCoreInfo,
  'name' | 'memberNumber' | 'primaryEmailAddress' | 'pastMemberNumbers'
> & {
  markedTrainerByActor: O.Option<Actor>;
  trainerSince: Date;
};

export type MinimalEquipment = {
  id: UUID;
  name: string;
  areaId: UUID;
  category: EquipmentCategory;
  // Unit names when this record stands for several identical machines.
  machineNames: ReadonlyArray<string>;
  trainingSheetId: O.Option<string>;
  // The machine's page on equipment.makespace.org, recorded by an owner. None
  // until somebody sets it: the app never guesses an address it cannot check.
  guideUrl: O.Option<string>;
  // Where the written risk assessment for this machine lives.
  riskAssessmentUrl: O.Option<string>;
  // What to learn before using it, printed under "Learn" on its sign. Empty
  // when nobody has written any.
  learnPoints: ReadonlyArray<string>;
  // Set when the equipment has been marked obsolete (soft-hidden).
  removedAt: O.Option<Date>;
  // The area's own grouping for it; none when the area has no categories or
  // nobody has sorted it into one yet.
  areaCategoryId: O.Option<UUID>;
};

export type Equipment = {
  trainers: ReadonlyArray<TrainerInfo>;
  trainedMembers: ReadonlyArray<TrainedMember>;
  area: MinimalArea;
} & Omit<MinimalEquipment, 'areaId'>;

export type TrainedOn = {
  id: string;
  name: string;
  trainedAt: Date;
};

export type TrainerFor = {
  equipment_id: UUID;
  equipment_name: string;
  since: Date;
};

export type MemberEmail = {
  emailAddress: EmailAddress;
  verifiedAt: O.Option<Date>;
  verificationLastSent: O.Option<Date>;
  addedAt: Date;
  // See MemberEmailLinkedByAdmin.
  linkedByAdmin: boolean;
};

export type MemberFob = {
  fobId: number;
  accessLevel: string;
  // The holder's name as it appeared in the Paxton export.
  paxtonName: string;
  recordedAt: Date;
};

export type OwnerOf = {
  id: string;
  name: string;
  ownershipRecordedAt: Date;
};

export type MemberCoreInfo = {
  userId: UserId;
  memberNumber: number;
  pastMemberNumbers: ReadonlyArray<number>;
  primaryEmailAddress: EmailAddress;
  emails: ReadonlyArray<MemberEmail>;
  // Only visible to super users; see member/redact.ts.
  fobs: ReadonlyArray<MemberFob>;
  name: O.Option<string>;
  formOfAddress: O.Option<string>;
  ownerAgreement: O.Option<SignedOwnerAgreement>;
  isSuperUser: boolean;
  superUserSince: O.Option<Date>;
  gravatarHash: GravatarHash;
  joined: Date;
};

export const allMemberNumbers = (
  m: Pick<MemberCoreInfo, 'memberNumber' | 'pastMemberNumbers'>
): ReadonlyArray<number> => [m.memberNumber, ...m.pastMemberNumbers];

export type Member = MemberCoreInfo & {
  trainedOn: ReadonlyArray<TrainedOn>;
  trainerFor: ReadonlyArray<TrainerFor>;
  ownerOf: ReadonlyArray<OwnerOf>;
};

// One of an area's own groupings for its equipment.
export type AreaEquipmentCategory = {
  id: UUID;
  areaId: UUID;
  name: string;
};

export type MinimalArea = {
  id: UUID;
  name: string;
  email: O.Option<EmailAddress>;
};

export type Owner = Pick<
  MemberCoreInfo,
  | 'userId'
  | 'memberNumber'
  | 'name'
  | 'primaryEmailAddress'
  | 'pastMemberNumbers'
  | 'ownerAgreement'
> & {
  ownershipRecordedAt: Date;
  markedOwnerBy: O.Option<Actor>;
};

export type Area = MinimalArea & {
  owners: ReadonlyArray<Owner>;
  equipment: ReadonlyArray<Equipment>;
};

export type PurchasingAreaSummary = {
  id: UUID;
  name: string;
};

export type PurchasingAreaPurchaser = Pick<
  MemberCoreInfo,
  | 'userId'
  | 'memberNumber'
  | 'pastMemberNumbers'
  | 'name'
  | 'primaryEmailAddress'
> & {
  addedAt: Date;
  // Purchasers are expected to own at least one of the purchasing area's
  // areas; false flags one who has since stopped being an owner.
  isOwnerOfAnArea: boolean;
};

// Money in pence. Budget figures are for `budgetYear`, the calendar year the
// view was asked about.
// Spending a super user recorded directly against a year's budget.
export type RecordedSpend = {
  id: UUID;
  amountPence: number;
  description: string;
  // Out of the yearly budget, or approved spending outside it.
  kind: RecordedSpendKind;
  recordedAt: Date;
};

export type PurchasingArea = PurchasingAreaSummary & {
  // Only an active purchasing area takes purchase requests; until a super
  // user activates it, it is still being set up.
  active: boolean;
  // This budget year's budget: the usual one, unless it has been set
  // differently for this year (e.g. extended).
  yearlyBudgetPence: number;
  // The budget every year has unless set differently for that year.
  usualBudgetPence: number;
  areas: ReadonlyArray<{id: UUID; name: string}>;
  purchasers: ReadonlyArray<PurchasingAreaPurchaser>;
  budgetYear: number;
  // Purchase requests that count against the budget, plus spending recorded
  // against it.
  spentThisYearPence: number;
  // Recorded spending approved outside the budget, which doesn't count.
  approvedSpendThisYearPence: number;
  // This year's requests still waiting for approval, which don't count yet.
  awaitingApprovalPence: number;
  // This budget year's recorded spending, oldest first.
  recordedSpend: ReadonlyArray<RecordedSpend>;
  // Negative when this year's spending has gone past the budget.
  remainingPence: number;
};


export type PurchaseRequest = {
  id: UUID;
  purchasingAreaId: UUID;
  submittedByMemberNumber: number;
  submittedAt: Date;
  budgetYear: number;
  summary: string;
  // The sum of the shop costs: what the outcome was worked out from and what
  // counts against the budget.
  totalPence: number;
  purchases: ReadonlyArray<Purchase>;
  justification: string;
  isMemberPaidConsumable: boolean;
  // Other areas it affects, whose owners need a chance to give their input.
  affectedAreaIds: ReadonlyArray<UUID>;
  // A moderate to high health and safety risk that will need mitigating.
  healthAndSafetyRisk: boolean;
  // The proposal it was sent with, when it needs one.
  proposal: O.Option<Proposal>;
  // Awaiting approval until a super user approves or declines it; only
  // approved requests count against the budget.
  status: PurchaseRequestStatus;
  decidedAt: O.Option<Date>;
  decidedByMemberNumber: O.Option<number>;
  declineReason: O.Option<string>;
  // What was agreed, given when approving.
  approvalNote: O.Option<string>;
  // Once bought after being approved.
  boughtAt: O.Option<Date>;
  boughtByMemberNumber: O.Option<number>;
  // What it really cost, when different from totalPence.
  actualCostPence: O.Option<number>;
  outcome: PurchaseRequestOutcome;
  approval: PurchaseApproval;
  outcomeReason: string;
  // The budget figures the outcome was computed from, at submission.
  yearlyBudgetPence: number;
  spentThisYearPence: number;
};
