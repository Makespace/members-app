import * as t from 'io-ts';

// Where a purchase request lands once its classification questions have been
// answered. See src/purchasing/classify-purchase.ts for the rules.
//
// OpEx (the three opex-* outcomes) is recorded but never counts against a
// purchasing area's yearly budget; CapEx does.
export const PurchaseRequestOutcomeCodec = t.keyof({
  'opex-consumable': null,
  'opex-operations': null,
  'opex-low-cost': null,
  'capex-from-budget': null,
  'capex-proposal-needed': null,
});

export type PurchaseRequestOutcome = t.TypeOf<
  typeof PurchaseRequestOutcomeCodec
>;

// Whose say-so a purchase request needs before it goes ahead. Operations
// spending doesn't use the budget, but over £500 needs the directors to
// agree; CapEx
// over the limits needs a proposal. Only the requirement is recorded so far -
// an approval step, when built, attaches to the request by its id.
export const PurchaseApprovalCodec = t.keyof({
  none: null,
  directors: null,
  proposal: null,
});

export type PurchaseApproval = t.TypeOf<typeof PurchaseApprovalCodec>;
