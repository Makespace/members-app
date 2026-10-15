import {html, safe} from '../types/html';
import {
  PurchaseApproval,
  PurchaseRequestOutcome,
} from '../types/purchase-request-outcome';

const labels: Record<PurchaseRequestOutcome, string> = {
  consumable: 'Consumable - not from the budget',
  budget: 'Yearly budget',
  'budget-proposal-needed': 'Yearly budget - proposal needed',
};

// The outcome, as a tag. The approval a request needs is part of the
// outcome's label for now (only a proposal is ever needed); it is passed so
// pages need not change when other kinds of approval appear.
export const renderOutcome = (
  outcome: PurchaseRequestOutcome,
  approval: PurchaseApproval
) =>
  html`<span
    class="purchase-outcome purchase-outcome--${safe(outcome)}"
    data-approval="${safe(approval)}"
    >${safe(labels[outcome])}</span
  >`;
