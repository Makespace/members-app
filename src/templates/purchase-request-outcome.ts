import {html, safe} from '../types/html';
import {
  PurchaseApproval,
  PurchaseRequestOutcome,
} from '../types/purchase-request-outcome';

const tags: Record<PurchaseRequestOutcome, {label: string; colour: string}> = {
  consumable: {
    label: 'Paid for by members (not from the yearly budget)',
    colour: 'green',
  },
  budget: {label: 'Yearly budget', colour: 'yellow'},
  'budget-proposal-needed': {
    label: 'Yearly budget · Proposal needed',
    colour: 'red',
  },
  'outside-budget': {label: 'Approved outside the yearly budget', colour: 'blue'},
};

// The outcome, as a tag. A consumable usually needs nothing, but can still
// need a proposal (e.g. for a risk assessment).
export const renderOutcome = (
  outcome: PurchaseRequestOutcome,
  approval: PurchaseApproval
) => {
  const tag =
    outcome === 'consumable' && approval === 'proposal'
      ? {label: 'Paid for by members · Proposal needed', colour: 'red'}
      : tags[outcome];
  return html`<span
    class="tag tag--${safe(tag.colour)} purchase-outcome"
    data-approval="${safe(approval)}"
    >${safe(tag.label)}</span
  >`;
};
