import {html, safe} from '../types/html';
import {PurchaseRequestStatus} from '../types/purchase-request-status';
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

// The budget it came from, without saying whether a proposal was needed.
const withoutProposal = (outcome: PurchaseRequestOutcome) =>
  outcome === 'budget-proposal-needed' ? tags.budget : tags[outcome];

// The outcome, as a tag. A consumable usually needs nothing, but can still
// need a proposal (e.g. for a risk assessment). "Proposal needed" is red
// only while it's still needed: once a request is approved it says the
// proposal was approved, and once declined or bought directly (a super user
// going ahead without one) it's just the budget, as the status says the rest.
export const renderOutcome = (
  outcome: PurchaseRequestOutcome,
  approval: PurchaseApproval,
  status?: PurchaseRequestStatus
) => {
  const base = withoutProposal(outcome);
  const tag =
    approval !== 'proposal' || status === undefined || status === 'awaiting-approval'
      ? outcome === 'consumable' && approval === 'proposal'
        ? {label: 'Paid for by members · Proposal needed', colour: 'red'}
        : tags[outcome]
      : status === 'approved'
        ? {label: `${base.label} · Proposal approved`, colour: base.colour}
        : base;
  return html`<span
    class="tag tag--${safe(tag.colour)} purchase-outcome"
    data-approval="${safe(approval)}"
    >${safe(tag.label)}</span
  >`;
};

// Next to "Proposal needed" when a super user goes ahead without one: only
// they can, and only when its cost alone needs one.
export const renderSuperUserOverride = () =>
  html`<span class="tag tag--super-user purchase-outcome"
    >Super user override: no proposal</span
  >`;
