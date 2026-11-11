import * as t from 'io-ts';

// Where a purchase request lands once it has been classified. See
// src/purchasing/classify-purchase.ts for the rules.
//
// A consumable members pay for at point of use, and a repair, are recorded
// but never count against a purchasing area's yearly budget; everything else
// comes out of it.
export const PurchaseRequestOutcomeCodec = t.keyof({
  consumable: null,
  budget: null,
  'budget-proposal-needed': null,
  // A super user's direct purchase the directors approved separately: it
  // doesn't count against the yearly budget.
  'outside-budget': null,
  // Repairs and running costs: paid for, but not from the yearly budget.
  repair: null,
});

export type PurchaseRequestOutcome = t.TypeOf<
  typeof PurchaseRequestOutcomeCodec
>;

// Whose say-so a purchase request needs before it goes ahead: a proposal for
// a large purchase, one that would overspend the budget, one that affects
// other areas or one with a moderate to high health and safety risk; a super
// user's approval (without a proposal) for a repair of the purchasing area's
// small repairs amount or more; otherwise none, meaning a purchaser can
// approve it. A consumable or repair can need a proposal too.
// Only the requirement is recorded so far - an approval step, when built,
// attaches to the request by its id.
export const PurchaseApprovalCodec = t.keyof({
  none: null,
  proposal: null,
  'super-user': null,
});

export type PurchaseApproval = t.TypeOf<typeof PurchaseApprovalCodec>;
