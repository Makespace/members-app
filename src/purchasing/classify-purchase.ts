import * as E from 'fp-ts/Either';
import {formatPence} from '../types/money';
import {
  PurchaseApproval,
  PurchaseRequestOutcome,
} from '../types/purchase-request-outcome';

// The one place that decides where a purchase request lands. The submit
// command always recomputes the outcome with this - whatever a browser
// previewed is never trusted - and records the result on the event.
//
// The questions are asked in order and the first "yes" settles it:
//   1. A consumable members pay for at point of use?          -> OpEx
//   2. Maintenance / running cost / like-for-like replacement? -> OpEx
//   3. Under £100 a year?                                      -> OpEx
// Otherwise it is CapEx, which needs a proposal when it is a single purchase
// of £1,000 or more, or when it would take this year's CapEx past the
// purchasing area's yearly budget. Anything else comes out of the budget.
//
// Alongside the outcome comes the approval it needs: operations spending over
// £500 needs the directors' approval (though not the budget), a
// proposal-needed purchase needs a proposal, and everything else needs none.

// A single CapEx purchase of this much or more always needs a proposal.
export const PROPOSAL_THRESHOLD_PENCE = 100_000;

// Operations spending of more than this (strictly) needs the directors'
// approval; this much or less needs none.
export const DIRECTORS_APPROVAL_THRESHOLD_PENCE = 50_000;

// Later questions are only asked when every earlier answer was "no", so they
// may be missing (null) when an earlier answer already settled it.
export type ClassificationAnswers = {
  isMemberPaidConsumable: boolean;
  isOperations: boolean | null;
  under100PerYear: boolean | null;
};

type ClassificationInput = {
  answers: ClassificationAnswers;
  amountPence: number;
  yearlyBudgetPence: number;
  // CapEx already submitted for this purchasing area this budget year, not
  // counting the request being classified.
  spentThisYearPence: number;
};

type Classification = {
  outcome: PurchaseRequestOutcome;
  approval: PurchaseApproval;
  reason: string;
  // The answers that were actually needed: anything after the deciding "yes"
  // is dropped to null, so the record never carries an answer that played no
  // part in the outcome.
  answers: ClassificationAnswers;
};

type UnansweredQuestion = {
  question: 'isOperations' | 'under100PerYear';
  message: string;
};

const OPEX_NOTE = "It is OpEx, so it doesn't come out of the yearly budget.";

export const classifyPurchase = (
  input: ClassificationInput
): E.Either<UnansweredQuestion, Classification> => {
  const {answers, amountPence, yearlyBudgetPence, spentThisYearPence} = input;

  if (answers.isMemberPaidConsumable) {
    return E.right({
      outcome: 'opex-consumable',
      approval: 'none',
      reason: `Members pay for this at point of use, so it is a consumable. ${OPEX_NOTE}`,
      answers: {
        isMemberPaidConsumable: true,
        isOperations: null,
        under100PerYear: null,
      },
    });
  }

  if (answers.isOperations === null) {
    return E.left({
      question: 'isOperations',
      message:
        'Please say whether this is maintenance, a running cost or a like-for-like replacement.',
    });
  }
  if (answers.isOperations) {
    const needsDirectors = amountPence > DIRECTORS_APPROVAL_THRESHOLD_PENCE;
    return E.right({
      outcome: 'opex-operations',
      approval: needsDirectors ? 'directors' : 'none',
      reason: `This keeps things running safely (maintenance, a running cost or a like-for-like replacement). ${OPEX_NOTE}${
        needsDirectors
          ? ` At over ${formatPence(DIRECTORS_APPROVAL_THRESHOLD_PENCE)} it needs the directors' approval.`
          : ''
      }`,
      answers: {
        isMemberPaidConsumable: false,
        isOperations: true,
        under100PerYear: null,
      },
    });
  }

  if (answers.under100PerYear === null) {
    return E.left({
      question: 'under100PerYear',
      message: 'Please say whether this will cost under £100 a year.',
    });
  }
  const allAnswers: ClassificationAnswers = {
    isMemberPaidConsumable: false,
    isOperations: false,
    under100PerYear: answers.under100PerYear,
  };
  if (answers.under100PerYear) {
    return E.right({
      outcome: 'opex-low-cost',
      approval: 'none',
      reason: `It costs under £100 a year. ${OPEX_NOTE}`,
      answers: allAnswers,
    });
  }

  if (amountPence >= PROPOSAL_THRESHOLD_PENCE) {
    return E.right({
      outcome: 'capex-proposal-needed',
      approval: 'proposal',
      reason: `A single purchase of ${formatPence(PROPOSAL_THRESHOLD_PENCE)} or more needs a proposal.`,
      answers: allAnswers,
    });
  }

  const spentAfter = spentThisYearPence + amountPence;
  if (spentAfter > yearlyBudgetPence) {
    return E.right({
      outcome: 'capex-proposal-needed',
      approval: 'proposal',
      reason: `This would take this year's spending to ${formatPence(spentAfter)}, over the yearly budget of ${formatPence(yearlyBudgetPence)}, so it needs a proposal.`,
      answers: allAnswers,
    });
  }

  return E.right({
    outcome: 'capex-from-budget',
    approval: 'none',
    reason: `This comes out of the yearly budget, leaving ${formatPence(yearlyBudgetPence - spentAfter)} of ${formatPence(yearlyBudgetPence)} for the rest of the year.`,
    answers: allAnswers,
  });
};
