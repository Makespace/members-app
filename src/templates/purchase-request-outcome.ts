import {html, safe} from '../types/html';
import {
  PurchaseApproval,
  PurchaseRequestOutcome,
} from '../types/purchase-request-outcome';

const tags: Record<PurchaseRequestOutcome, {label: string; colour: string}> = {
  consumable: {
    label: 'Consumable (not from the yearly budget)',
    colour: 'green',
  },
  budget: {label: 'Yearly budget', colour: 'yellow'},
  'budget-proposal-needed': {
    label: 'Yearly budget · Proposal needed',
    colour: 'red',
  },
};

// The outcome, as a tag. The approval a request needs is part of the
// outcome's label for now (only a proposal is ever needed); it is passed so
// pages need not change when other kinds of approval appear.
export const renderOutcome = (
  outcome: PurchaseRequestOutcome,
  approval: PurchaseApproval
) =>
  html`<span
    class="tag tag--${safe(tags[outcome].colour)} purchase-outcome"
    data-approval="${safe(approval)}"
    >${safe(tags[outcome].label)}</span
  >`;
