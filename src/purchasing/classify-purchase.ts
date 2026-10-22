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
// needs a proposal when the total is £1,000 or more, or when it would take
// this year's spending past the yearly budget; landing exactly on the budget
// is fine.
//
// Any purchase, consumable or not, also needs a proposal when it affects
// other areas (so their owners can give their input) or presents a moderate
// to high health and safety risk (so it gets a risk assessment). The reason
// says everything that applies, one sentence each.

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
  // Other areas the purchase affects, by name; none if it affects no others.
  affectedAreaNames: ReadonlyArray<string>;
  // A moderate to high health and safety risk that will need mitigating.
  healthAndSafetyRisk: boolean;
};

export type Classification = {
  outcome: PurchaseRequestOutcome;
  approval: PurchaseApproval;
  reason: string;
};

// "A", "A and B", "A, B and C".
const listOf = (names: ReadonlyArray<string>) =>
  names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

// Sentences for the reasons any purchase can need a proposal.
const otherReasons = ({
  affectedAreaNames,
  healthAndSafetyRisk,
}: ClassificationInput): ReadonlyArray<string> => [
  ...(affectedAreaNames.length > 0
    ? [
        `It affects ${listOf(affectedAreaNames)} too, so it needs a proposal giving their owners a chance to give their input.`,
      ]
    : []),
  ...(healthAndSafetyRisk
    ? [
        'It presents a moderate to high health and safety risk, so it needs a proposal with a risk assessment.',
      ]
    : []),
];

export const classifyPurchase = (
  input: ClassificationInput
): Classification => {
  const {
    isMemberPaidConsumable,
    amountPence,
    yearlyBudgetPence,
    spentThisYearPence,
  } = input;
  const others = otherReasons(input);
  const withOthers = (sentence: string) => [sentence, ...others].join(' ');

  if (isMemberPaidConsumable) {
    return {
      outcome: 'consumable',
      approval: others.length > 0 ? 'proposal' : 'none',
      reason: withOthers(
        "Members pay for this, so it doesn't come out of the yearly budget."
      ),
    };
  }

  if (amountPence >= PROPOSAL_THRESHOLD_PENCE) {
    return {
      outcome: 'budget-proposal-needed',
      approval: 'proposal',
      reason: withOthers(
        `A single purchase of ${formatPence(PROPOSAL_THRESHOLD_PENCE)} or more needs a proposal.`
      ),
    };
  }

  const spentAfter = spentThisYearPence + amountPence;
  if (spentAfter > yearlyBudgetPence) {
    return {
      outcome: 'budget-proposal-needed',
      approval: 'proposal',
      reason: withOthers(
        `This would take this year's spending to ${formatPence(spentAfter)}, over the yearly budget of ${formatPence(yearlyBudgetPence)}, so it needs a proposal.`
      ),
    };
  }

  return {
    outcome: others.length > 0 ? 'budget-proposal-needed' : 'budget',
    approval: others.length > 0 ? 'proposal' : 'none',
    reason: withOthers(
      `This comes out of the yearly budget, leaving ${formatPence(yearlyBudgetPence - spentAfter)} of ${formatPence(yearlyBudgetPence)} for the rest of the year.`
    ),
  };
};
