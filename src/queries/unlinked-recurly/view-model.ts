import * as O from 'fp-ts/Option';

export type UnlinkedRecurlyEntry = {
  email: string;
  // The account code, usually the email the member signed up with; the app
  // may know them by that address rather than the one Recurly now bills.
  accountCode: O.Option<string>;
  hasActiveSubscription: boolean;
  hasFutureSubscription: boolean;
  hasCanceledSubscription: boolean;
  hasPausedSubscription: boolean;
  hasPastDueInvoice: boolean;
  cacheLastUpdated: Date;
};

export type ViewModel = {
  // Paying (or about to) but matched to nobody: the rows that need an admin.
  needingAction: ReadonlyArray<UnlinkedRecurlyEntry>;
  // Lapsed, cancelled or paused accounts nobody in the app answers to.
  theRest: ReadonlyArray<UnlinkedRecurlyEntry>;
};

export const needsAction = (entry: UnlinkedRecurlyEntry): boolean =>
  entry.hasActiveSubscription ||
  entry.hasFutureSubscription ||
  entry.hasPastDueInvoice;
