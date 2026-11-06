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
// SumUp) doesn't come out of the yearly budget, and nor do repairs and
// running costs: a purchaser can approve a repair costing less than the
// purchasing area's small repairs amount, and one costing that or more needs
// a super user's approval. Everything else (improvements) comes out of the
// yearly budget. A budget purchase
// needs a proposal when the total is the purchasing area's small purchase
// amount or more, or when it would take this year's spending past the yearly
// budget; landing exactly on the budget is fine.
//
// Any purchase, consumable or not, also needs a proposal when it affects
// other areas (so their owners can give their input) or presents a moderate
// to high health and safety risk (so it gets a risk assessment). The reason
// says everything that applies, one sentence each.

// How much a single budget purchase can cost before it needs a proposal, for
// a purchasing area created now. Each purchasing area has its own, which a
// super user can change; ones created before it could be set kept £1,000.
export const DEFAULT_SMALL_PURCHASE_AMOUNT_PENCE = 50_000;

// How much a single repair can cost before it needs a super user's approval,
// until a super user sets a purchasing area's own.
export const DEFAULT_SMALL_REPAIRS_AMOUNT_PENCE = 15_000;

type ClassificationInput = {
  isMemberPaidConsumable: boolean;
  // Repairs and running costs, which don't come out of the yearly budget.
  isRepair: boolean;
  // The estimated total.
  amountPence: number;
  // A single budget purchase of this much or more needs a proposal.
  smallPurchaseAmountPence: number;
  // A single repair of this much or more needs a super user's approval.
  smallRepairsAmountPence: number;
  yearlyBudgetPence: number;
  // Already spent from the budget this budget year, not counting the request
  // being classified.
  spentThisYearPence: number;
  // Other areas the purchase affects, by name; none if it affects no others.
  affectedAreaNames: ReadonlyArray<string>;
  // A moderate to high health and safety risk that will need mitigating.
  healthAndSafetyRisk: boolean;
  // A super user buying it directly says the directors approved it outside
  // the yearly budget. Only they can; see src/purchasing/buy-directly.ts.
  approvedOutsideBudget?: boolean;
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
}: Pick<
  ClassificationInput,
  'affectedAreaNames' | 'healthAndSafetyRisk'
>): ReadonlyArray<string> => [
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

  if (input.approvedOutsideBudget) {
    return {
      outcome: 'outside-budget',
      approval: others.length > 0 ? 'proposal' : 'none',
      reason: withOthers(
        "Approved outside the yearly budget, so it doesn't count against it."
      ),
    };
  }

  if (isMemberPaidConsumable) {
    return {
      outcome: 'consumable',
      approval: others.length > 0 ? 'proposal' : 'none',
      reason: withOthers(
        "Members pay for this, so it doesn't come out of the yearly budget."
      ),
    };
  }

  if (input.isRepair) {
    const notFromBudget = "Repairs and running costs don't come out of the yearly budget.";
    if (others.length > 0) {
      return {
        outcome: 'repair',
        approval: 'proposal',
        reason: withOthers(notFromBudget),
      };
    }
    return amountPence >= input.smallRepairsAmountPence
      ? {
          outcome: 'repair',
          approval: 'super-user',
          reason: `${notFromBudget} A repair of ${formatPence(input.smallRepairsAmountPence)} or more needs a super user's approval.`,
        }
      : {
          outcome: 'repair',
          approval: 'none',
          reason: `${notFromBudget} A purchaser can approve a repair under ${formatPence(input.smallRepairsAmountPence)}.`,
        };
  }

  if (amountPence >= input.smallPurchaseAmountPence) {
    return {
      outcome: 'budget-proposal-needed',
      approval: 'proposal',
      reason: withOthers(
        `A single purchase of ${formatPence(input.smallPurchaseAmountPence)} or more needs a proposal.`
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

// Why it will need a proposal whatever it costs, known from the answers
// about the request before any costs are given: it affects other areas, it
// presents a health and safety risk, or - unless members pay for it - the
// yearly budget is already used up, so any cost takes spending over it.
// Repairs don't come out of the budget, so a used-up budget doesn't matter.
// Empty when it depends on the cost. classifyPurchase still decides.
export const earlyProposalReasons = (
  input: Omit<ClassificationInput, 'amountPence' | 'approvedOutsideBudget'>
): ReadonlyArray<string> => [
  ...(!input.isMemberPaidConsumable &&
  !input.isRepair &&
  input.spentThisYearPence >= input.yearlyBudgetPence
    ? [
        `This year's spending is already ${formatPence(input.spentThisYearPence)}, using up the yearly budget of ${formatPence(input.yearlyBudgetPence)}, so anything more from it needs a proposal.`,
      ]
    : []),
  ...otherReasons(input),
];
