import * as O from 'fp-ts/Option';
import {
  MemberCoreInfo,
  MemberFob,
} from '../../read-models/shared-state/return-types';
import {
  RecurlyFlags,
  RecurlyReason,
} from '../../read-models/external-state/recurly-status';
import {BillingConcern} from '../../read-models/external-state/billing-overview';
import {bandFor} from '../outstanding-invoices/view-model';

// What the door system will do for this member, read off their recorded
// Paxton fobs. Paxton's access levels are numbered: 1x lets people in, 2 is
// parked, 3 cancelled, 9 sanctioned. A member holding several fobs gets the
// most permissive of them, since that is the one that opens the door.
type FobAccess = 'live' | 'parked' | 'sanctioned' | 'cancelled' | 'none';

const fobAccessOf = (fob: Pick<MemberFob, 'accessLevel'>): FobAccess => {
  const level = fob.accessLevel.trim();
  if (level.startsWith('1')) {
    return 'live';
  }
  if (level.startsWith('2')) {
    return 'parked';
  }
  if (level.startsWith('9')) {
    return 'sanctioned';
  }
  if (level.startsWith('3')) {
    return 'cancelled';
  }
  return 'none';
};

const ACCESS_RANK: Record<FobAccess, number> = {
  live: 4,
  parked: 3,
  sanctioned: 2,
  cancelled: 1,
  none: 0,
};

export const fobAccessOfMember = (
  member: Pick<MemberCoreInfo, 'fobs'>
): FobAccess =>
  member.fobs
    .map(fobAccessOf)
    .reduce<FobAccess>(
      (best, access) => (ACCESS_RANK[access] > ACCESS_RANK[best] ? access : best),
      'none'
    );

// Whether membership says they should get in. The one rule beyond "has a
// live subscription" is the billing one already used by /outstanding-
// invoices: far enough behind on payment and access goes, which the trustees
// set in days through configuration.
export type Entitlement =
  | {kind: 'entitled'}
  | {
      kind: 'not-entitled';
      why: 'overdue' | 'expired' | 'no-data' | 'future-only' | 'paused';
      daysOverdue: O.Option<number>;
    };

const whyNotEntitled = (
  reasons: ReadonlyArray<RecurlyReason>
): Exclude<Entitlement, {kind: 'entitled'}>['why'] => {
  if (reasons.includes('no-data')) {
    return 'no-data';
  }
  if (reasons.includes('future-only')) {
    return 'future-only';
  }
  if (reasons.includes('paused')) {
    return 'paused';
  }
  return 'expired';
};

export const entitlementOf = (
  recurly: {flags: O.Option<RecurlyFlags>; reasons: ReadonlyArray<RecurlyReason>},
  concern: O.Option<Pick<BillingConcern, 'kind' | 'daysOverdue'>>,
  thresholds: {removeAccessAfterDays: number; cancelAfterDays: number}
): Entitlement => {
  if (
    O.isSome(concern) &&
    concern.value.kind === 'overdue' &&
    bandFor(concern.value.daysOverdue, thresholds) !== 'watch'
  ) {
    return {kind: 'not-entitled', why: 'overdue', daysOverdue: concern.value.daysOverdue};
  }
  if (O.isSome(recurly.flags) && recurly.flags.value.hasActiveSubscription) {
    return {kind: 'entitled'};
  }
  return {kind: 'not-entitled', why: whyNotEntitled(recurly.reasons), daysOverdue: O.none};
};

export type AuditRow = {
  member: MemberCoreInfo;
  fobAccess: FobAccess;
  entitlement: Entitlement;
};

// The lists an admin acts on, from every member's row. Parked and sanctioned
// fobs are deliberate, so an entitled member holding one is shown separately
// rather than as a mistake to fix.
export type AuditGroups = {
  // Door opens for them; membership says it should not.
  toRevoke: ReadonlyArray<AuditRow>;
  // Membership says yes; their fob is cancelled in Paxton.
  toReinstate: ReadonlyArray<AuditRow>;
  // Membership says yes; the app knows of no fob for them.
  noFob: ReadonlyArray<AuditRow>;
  // Membership says yes; their fob is parked or sanctioned on purpose.
  pausedOnPurpose: ReadonlyArray<AuditRow>;
  // Entitled with a live fob, and not entitled without one.
  consistent: number;
};

export const groupRows = (rows: ReadonlyArray<AuditRow>): AuditGroups => {
  const groups = {
    toRevoke: [] as AuditRow[],
    toReinstate: [] as AuditRow[],
    noFob: [] as AuditRow[],
    pausedOnPurpose: [] as AuditRow[],
    consistent: 0,
  };
  for (const row of rows) {
    const entitled = row.entitlement.kind === 'entitled';
    if (!entitled) {
      if (row.fobAccess === 'live') {
        groups.toRevoke.push(row);
      } else {
        groups.consistent += 1;
      }
      continue;
    }
    switch (row.fobAccess) {
      case 'live':
        groups.consistent += 1;
        break;
      case 'cancelled':
        groups.toReinstate.push(row);
        break;
      case 'none':
        groups.noFob.push(row);
        break;
      case 'parked':
      case 'sanctioned':
        groups.pausedOnPurpose.push(row);
        break;
    }
  }
  return groups;
};
