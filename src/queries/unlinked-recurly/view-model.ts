export type UnlinkedRecurlyEntry = {
  email: string;
  // Account codes pointing at this billing email that differ from it: usually
  // the email the member signed up with, and why the row is here at all.
  otherCodes: ReadonlyArray<string>;
  hasActiveSubscription: boolean;
  hasFutureSubscription: boolean;
  hasCanceledSubscription: boolean;
  hasPausedSubscription: boolean;
  hasPastDueInvoice: boolean;
  cacheLastUpdated: Date;
  // Refreshed by the sync within the window every other Recurly reader
  // trusts. Rows the sync has stopped touching (an account deleted or merged
  // in Recurly) go stale and are never deleted here.
  isFresh: boolean;
};

export type ViewModel = {
  // Paying (or about to) and fresh, but matched to nobody: needs an admin.
  needingAction: ReadonlyArray<UnlinkedRecurlyEntry>;
  // Lapsed, cancelled, paused, never subscribed, or no longer synced.
  theRest: ReadonlyArray<UnlinkedRecurlyEntry>;
};

export const needsAction = (entry: UnlinkedRecurlyEntry): boolean =>
  entry.isFresh &&
  (entry.hasActiveSubscription ||
    entry.hasFutureSubscription ||
    entry.hasPastDueInvoice);
