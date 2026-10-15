import {html, safe} from '../types/html';
import {
  PurchaseApproval,
  PurchaseRequestOutcome,
} from '../types/purchase-request-outcome';

const labels: Record<PurchaseRequestOutcome, string> = {
  'opex-consumable': 'OpEx - consumable',
  'opex-operations': 'OpEx - operations',
  'opex-low-cost': 'OpEx - under £100 a year',
  'capex-from-budget': 'CapEx - from budget',
  'capex-proposal-needed': 'CapEx - proposal needed',
};

const approvalLabels: Record<PurchaseApproval, string | null> = {
  none: null,
  directors: "Directors' approval needed",
  proposal: 'Proposal needed',
};

const renderApproval = (approval: PurchaseApproval) => {
  const label = approvalLabels[approval];
  return label === null
    ? html``
    : html`<span
        class="purchase-approval purchase-approval--${safe(approval)}"
        >${safe(label)}</span
      >`;
};

// The outcome, plus a tag for any approval it needs. The proposal tag is
// left off when the outcome already says a proposal is needed.
export const renderOutcome = (
  outcome: PurchaseRequestOutcome,
  approval: PurchaseApproval
) =>
  html`<span class="purchase-outcome purchase-outcome--${safe(outcome)}"
      >${safe(labels[outcome])}</span
    >
    ${outcome === 'capex-proposal-needed' && approval === 'proposal'
      ? html``
      : renderApproval(approval)}`;
