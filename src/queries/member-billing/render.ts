import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {
  renderBillingHeadline,
  renderFullInvoiceRow,
  renderStaleWarning,
  renderWhyUnpaid,
} from '../../templates/billing-rows';
import {ViewModel} from './view-model';

const FULL_COLUMNS = 7;

export const render = (viewModel: ViewModel, now: Date = new Date()) => html`
  <div class="stack">
    <h1>Billing</h1>
    <p>
      <a href="/member/${safe(String(viewModel.memberNumber))}"
        >${sanitizeString(viewModel.memberName)}</a
      >
    </p>
    ${viewModel.billing.invoices.length === 0
      ? html`<p>
          No Recurly invoices are held against this member's verified
          addresses.
        </p>`
      : html`
          <p>${renderBillingHeadline(viewModel.billing)}</p>
          <table>
            <tr>
              <th>Invoice</th>
              <th>Raised</th>
              <th>Due</th>
              <th>Total</th>
              <th>Outstanding</th>
              <th>Overdue by</th>
              <th>State</th>
            </tr>
            ${joinHtml(
              viewModel.billing.invoices.map(
                invoice => html`
                  ${renderFullInvoiceRow(invoice)}${renderWhyUnpaid(
                    invoice,
                    FULL_COLUMNS
                  )}
                `
              )
            )}
          </table>
          ${renderStaleWarning(viewModel.billing, now)}
        `}
  </div>
`;
