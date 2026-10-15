import {html, joinHtml, sanitizeString} from '../../types/html';
import {formatPence} from '../../types/money';
import {PurchasingArea} from '../../read-models/shared-state/return-types';

type ViewModel = {
  budgetYear: number;
  purchasingAreas: ReadonlyArray<PurchasingArea>;
  canManage: boolean;
  canRequest: boolean;
};

const money = (pence: number) => sanitizeString(formatPence(pence));

const renderRow = (purchasingArea: PurchasingArea) => html`
  <tr>
    <td>
      <a href="/purchasing-areas/${purchasingArea.id}"
        >${sanitizeString(purchasingArea.name)}</a
      >
    </td>
    <td>
      ${purchasingArea.areas.length === 0
        ? html`<small>No areas yet</small>`
        : sanitizeString(purchasingArea.areas.map(area => area.name).join(', '))}
    </td>
    <td>${money(purchasingArea.yearlyBudgetPence)}</td>
    <td>${money(purchasingArea.spentThisYearPence)}</td>
    <td>${money(purchasingArea.remainingPence)}</td>
  </tr>
`;

const renderTable = (viewModel: ViewModel) =>
  viewModel.purchasingAreas.length === 0
    ? html`<p>There are no purchasing areas yet.</p>`
    : html`
        <table>
          <thead>
            <tr>
              <th>Purchasing area</th>
              <th>Areas</th>
              <th>Yearly budget</th>
              <th>Spent in ${viewModel.budgetYear}</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(viewModel.purchasingAreas.map(renderRow))}
          </tbody>
        </table>
      `;

export const render = (viewModel: ViewModel) => html`
  <div class="stack-large">
    <h1>Purchasing areas</h1>
    <p>
      Each purchasing area holds a yearly budget (1 January to 31 December) for
      one or more areas. It pays for keeping equipment running safely (repairs,
      servicing, running costs, replacements) as well as improvements.
      Consumables that members pay for at point of use are recorded without
      counting against it.
    </p>
    ${viewModel.canRequest || viewModel.canManage
      ? html`<div>
          ${viewModel.canRequest
            ? html`<a class="button" href="/purchase-requests/submit"
                >Request a purchase</a
              >`
            : html``}
          ${viewModel.canManage
            ? html`<a class="button" href="/purchasing-areas/create"
                >Create purchasing area</a
              >`
            : html``}
        </div>`
      : html``}
    ${renderTable(viewModel)}
  </div>
`;
