import {html, safe} from '../types/html';
import {PurchaseRequestStatus} from '../types/purchase-request-status';
import {PurchaseRequest} from '../read-models/shared-state/return-types';

const tags: Record<PurchaseRequestStatus, {label: string; colour: string}> = {
  'awaiting-approval': {label: 'Awaiting approval', colour: 'grey'},
  approved: {label: 'Approved', colour: 'green'},
  declined: {label: 'Declined', colour: 'red'},
  'bought-directly': {label: 'Bought directly', colour: 'blue'},
};

// Whose approval a request waits for: a director's when it needs a
// proposal, otherwise a purchaser's for its area.
export const awaitedApproval = ({approval}: Pick<PurchaseRequest, 'approval'>) =>
  approval === 'proposal' ? 'director' : 'purchaser';

// Where a purchase request has got to, as a tag.
export const renderStatus = ({
  status,
  approval,
}: Pick<PurchaseRequest, 'status' | 'approval'>) => {
  const label =
    status === 'awaiting-approval'
      ? `Awaiting ${awaitedApproval({approval})} approval`
      : tags[status].label;
  return html`<span class="tag tag--${safe(tags[status].colour)} purchase-outcome"
    >${safe(label)}</span
  >`;
};
