import * as O from 'fp-ts/Option';
import {html} from '../types/html';
import {PurchaseRequest} from '../read-models/shared-state/return-types';

// For a table of purchase requests: once bought, whether its receipt or
// invoice has gone to the accountant yet. Nothing to send before then.
export const renderInvoiceSent = (
  request: Pick<PurchaseRequest, 'status' | 'invoiceSentAt'>
) =>
  request.status !== 'bought' && request.status !== 'bought-directly'
    ? html`-`
    : O.isSome(request.invoiceSentAt)
      ? html`<span class="tag tag--green purchase-outcome">Sent</span>`
      : html`<span class="tag tag--yellow purchase-outcome">Not sent yet</span>`;
