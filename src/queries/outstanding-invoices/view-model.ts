import * as O from 'fp-ts/Option';
import {
  BillingConcern,
  UnlinkedDebt,
} from '../../read-models/external-state/billing-overview';

// How far behind somebody is, in terms of what it means rather than a number.
// The day counts come from configuration: trustees set them, not the code.
export type OverdueBand = 'cancel' | 'remove-access' | 'watch';

export type ViewModel = {
  bands: ReadonlyArray<{band: OverdueBand; concerns: ReadonlyArray<BillingConcern>}>;
  pausedOwing: ReadonlyArray<BillingConcern>;
  lapsed: ReadonlyArray<BillingConcern>;
  unlinked: ReadonlyArray<UnlinkedDebt>;
  cachedAt: O.Option<Date>;
  isStale: boolean;
  thresholds: {removeAccessAfterDays: number; cancelAfterDays: number};
};

// Pure: the only thing deciding who lands in which band.
export const bandFor = (
  daysOverdue: O.Option<number>,
  thresholds: {removeAccessAfterDays: number; cancelAfterDays: number}
): OverdueBand => {
  const days = O.getOrElse(() => 0)(daysOverdue);
  if (days >= thresholds.cancelAfterDays) {
    return 'cancel';
  }
  return days >= thresholds.removeAccessAfterDays ? 'remove-access' : 'watch';
};
