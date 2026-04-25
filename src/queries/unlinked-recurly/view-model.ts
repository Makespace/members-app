export type UnlinkedRecurlyEntry = {
  email: string;
  hasActiveSubscription: boolean;
  hasFutureSubscription: boolean;
  hasCanceledSubscription: boolean;
  hasPausedSubscription: boolean;
  hasPastDueInvoice: boolean;
  cacheLastUpdated: Date;
};

export type ViewModel = {
  unlinkedEmails: ReadonlyArray<UnlinkedRecurlyEntry>;
  count: number;
};
