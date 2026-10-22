import {html, safe} from '../types/html';
import {PurchaseRequestStatus} from '../types/purchase-request-status';

const tags: Record<PurchaseRequestStatus, {label: string; colour: string}> = {
  'awaiting-approval': {label: 'Awaiting approval', colour: 'grey'},
  approved: {label: 'Approved', colour: 'green'},
  declined: {label: 'Declined', colour: 'red'},
  'bought-directly': {label: 'Bought directly', colour: 'blue'},
};

// Where a purchase request has got to, as a tag.
export const renderStatus = (status: PurchaseRequestStatus) =>
  html`<span class="tag tag--${safe(tags[status].colour)} purchase-outcome"
    >${safe(tags[status].label)}</span
  >`;
