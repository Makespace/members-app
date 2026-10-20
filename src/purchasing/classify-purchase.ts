import {formatPence} from '../types/money';
import {
  PurchaseApproval,
  PurchaseRequestOutcome,
} from '../types/purchase-request-outcome';

// The one place that decides where a purchase request lands. The submit
// command always recomputes the outcome with this - whatever a browser
// previewed is never trusted - and records the result on the event.
//
// A consumable members pay for at point of use (e.g. 3D printer filament via
// SumUp) doesn't come out of the yearly budget. Everything else does - the
// budget pays for keeping equipment running safely (repairs, servicing,
// running costs, replacements) as well as improvements. A budget purchase
// needs a proposal when the estimate is £1,000 or more, or when it would take
// this year's spending past the yearly budget; landing exactly on the budget
// is fine.

// A single budget purchase of this much or more always needs a proposal.
export const PROPOSAL_THRESHOLD_PENCE = 100_000;

type ClassificationInput = {
  isMemberPaidConsumable: boolean;
  // The estimated total.
  amountPence: number;
  yearlyBudgetPence: number;
  // Already spent from the budget this budget year, not counting the request
  // being classified.
  spentThisYearPence: number;
};

export type Classification = {
  outcome: PurchaseRequestOutcome;
  approval: PurchaseApproval;
  reason: string;
};

export const classifyPurchase = (
  input: ClassificationInput
): Classification => {
  const {
    isMemberPaidConsumable,
    amountPence,
    yearlyBudgetPence,
    spentThisYearPence,
  } = input;

  if (isMemberPaidConsumable) {
    return {
      outcome: 'consumable',
      approval: 'none',
      reason:
        "Members pay for this at point of use, so it is a consumable and doesn't come out of the yearly budget.",
    };
  }

  if (amountPence >= PROPOSAL_THRESHOLD_PENCE) {
    return {
      outcome: 'budget-proposal-needed',
      approval: 'proposal',
      reason: `A single purchase of ${formatPence(PROPOSAL_THRESHOLD_PENCE)} or more needs a proposal.`,
    };
  }

  const spentAfter = spentThisYearPence + amountPence;
  if (spentAfter > yearlyBudgetPence) {
    return {
      outcome: 'budget-proposal-needed',
      approval: 'proposal',
      reason: `This would take this year's spending to ${formatPence(spentAfter)}, over the yearly budget of ${formatPence(yearlyBudgetPence)}, so it needs a proposal.`,
    };
  }

  return {
    outcome: 'budget',
    approval: 'none',
    reason: `This comes out of the yearly budget, leaving ${formatPence(yearlyBudgetPence - spentAfter)} of ${formatPence(yearlyBudgetPence)} for the rest of the year.`,
  };
};
