import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {formatPence} from '../../types/money';
import {renderRemaining} from '../../templates/remaining-budget';
import {PurchasingArea} from '../../read-models/shared-state/return-types';
import {superUserActions, superUserButton} from '../../templates/super-user';
import {renderRecordPurchaseButton} from '../../templates/record-purchase-button';

type ViewModel = {
  budgetYear: number;
  // The yearly allowance per Area for this budget year, if one applies.
  allowancePerAreaPence: O.Option<number>;
  purchasingAreas: ReadonlyArray<PurchasingArea>;
  canManage: boolean;
  // Owners, purchasers and super users request purchases.
  canRequest: boolean;
  // A super user, or an active purchaser for some purchasing area.
  canBuyDirectly: boolean;
};

const money = (pence: number) => sanitizeString(formatPence(pence));

// This year's budget, and how far a one-off change for this year (e.g. an
// extension) moves it from the usual one.
const renderYearBudget = ({
  yearlyBudgetPence,
  usualBudgetPence,
  extensionPence,
}: PurchasingArea) => {
  const difference = yearlyBudgetPence - usualBudgetPence;
  return extensionPence > 0
    ? html`${money(yearlyBudgetPence)}
        <span class="tag tag--yellow">+${money(extensionPence)} extension</span>`
    : difference === 0
      ? money(yearlyBudgetPence)
      : html`${money(yearlyBudgetPence)}
          <span class="tag tag--yellow"
            >${difference > 0 ? html`+` : html`-`}${money(Math.abs(difference))}
            this year only</span
          >`;
};

const renderRow = (purchasingArea: PurchasingArea) => html`
  <tr>
    <td>
      <a href="/purchasing-areas/${purchasingArea.id}"
        >${sanitizeString(purchasingArea.name)}</a
      >
      ${purchasingArea.active
        ? html``
        : html`<span class="tag tag--grey">Not active</span>`}
    </td>
    <td>
      ${purchasingArea.areas.length === 0
        ? html`<small>No areas yet</small>`
        : sanitizeString(purchasingArea.areas.map(area => area.name).join(', '))}
    </td>
    <td>
      ${money(purchasingArea.usualBudgetPence)}
      ${pipe(
        purchasingArea.allowancePerAreaPence,
        O.match(
          () => html``,
          allowance =>
            html`<br /><small
                >${purchasingArea.areas.length}
                ${safe(purchasingArea.areas.length === 1 ? 'Area' : 'Areas')} ×
                ${money(allowance)}</small
              >`
        )
      )}
    </td>
    <td>${renderYearBudget(purchasingArea)}</td>
    <td>${money(purchasingArea.spentThisYearPence)}</td>
    <td>${renderRemaining(purchasingArea.remainingPence)}</td>
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
              <th>Usual budget</th>
              <th>${viewModel.budgetYear} budget</th>
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
      Each purchasing area holds a single yearly budget (1 January to 31
      December) for one or more areas, which pays for maintenance,
      improvements and non-recoverable consumables. Recoverable consumables
      members pay for themselves (e.g. filament paid for on SumUp) are
      recorded without counting against it.
    </p>
    ${pipe(
      viewModel.allowancePerAreaPence,
      O.match(
        () => html``,
        allowance => html`<p>
          Every Area is allocated ${money(allowance)} for
          ${viewModel.budgetYear}, and a purchasing area's usual budget is its
          Areas' allowances added together. A purchasing area can ask the
          managers and directors for an extension.
        </p>`
      )
    )}
    ${viewModel.canRequest
      ? html``
      : html`<p>
        Purchases are requested by the owners of an area. If something is
        missing or has run out, such as a consumable,
        <a href="/trouble-tickets/raise">raise a trouble ticket</a>.
      </p>`}
    <div class="wrap">
      ${viewModel.canRequest
        ? html`<a class="button" href="/purchase-requests/submit"
            >Request a purchase</a
          >`
        : html``}
      <a href="/purchase-requests">All purchase requests</a>
    </div>
    ${viewModel.canBuyDirectly ? renderRecordPurchaseButton() : html``}
    ${viewModel.canManage
      ? superUserActions(
          html`${superUserButton(
            '/purchasing-areas/create',
            html`Create purchasing area`
          )}
          ${superUserButton(
            '/purchasing-areas/set-allowance',
            html`Set yearly allowance per Area`
          )}`
        )
      : html``}
    ${renderTable(viewModel)}
  </div>
`;
