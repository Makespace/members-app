import * as t from 'io-ts';

// Where a purchase request lands once it has been classified. See
// src/purchasing/classify-purchase.ts for the rules.
//
// A consumable members pay for at point of use is recorded but never counts
// against a purchasing area's yearly budget; everything else comes out of it.
export const PurchaseRequestOutcomeCodec = t.keyof({
  consumable: null,
  budget: null,
  'budget-proposal-needed': null,
});

export type PurchaseRequestOutcome = t.TypeOf<
  typeof PurchaseRequestOutcomeCodec
>;

// Whose say-so a purchase request needs before it goes ahead: a proposal for
// a large purchase or one that would overspend the budget, otherwise none.
// Only the requirement is recorded so far - an approval step, when built,
// attaches to the request by its id.
export const PurchaseApprovalCodec = t.keyof({
  none: null,
  proposal: null,
});

export type PurchaseApproval = t.TypeOf<typeof PurchaseApprovalCodec>;
