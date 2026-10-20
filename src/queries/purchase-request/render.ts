import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {html, joinHtml, sanitizeString} from '../../types/html';
import {formatPence} from '../../types/money';
import {
  PurchaseRequest,
  PurchaseRequestPurchase,
  PurchasingAreaSummary,
} from '../../read-models/shared-state/return-types';
import {renderMemberNumber} from '../../templates/member-number';
import {displayDate} from '../../templates/display-date';
import {renderOutcome} from '../../templates/purchase-request-outcome';
import {countsAgainstBudget} from '../../purchasing/budget-year';

type ViewModel = {
  // Straight after submitting: shown as the confirmation of a sent request.
  justSent: boolean;
  request: PurchaseRequest;
  purchasingArea: O.Option<PurchasingAreaSummary>;
  submitterName: O.Option<string>;
};

const money = (pence: number) => sanitizeString(formatPence(pence));

const isWebLink = (link: string) => /^https?:\/\//i.test(link);

const renderShop = (purchase: PurchaseRequestPurchase) =>
  pipe(
    purchase.link,
    O.filter(isWebLink),
    O.match(
      () => html`${sanitizeString(purchase.shop)}`,
      url =>
        html`<a href="${sanitizeString(url)}" target="_blank" rel="noopener"
          >${sanitizeString(purchase.shop)}</a
        >`
    )
  );

const renderPurchaseRow = (purchase: PurchaseRequestPurchase) => html`
  <tr>
    <td>${renderShop(purchase)}</td>
    <td class="purchase-shops-table__items">
      ${sanitizeString(purchase.items)}
    </td>
    <td class="purchase-shops-table__cost">${money(purchase.costPence)}</td>
  </tr>
`;

// The itemised total decides the outcome; say so when it differs from the
// estimate the member gave first.
const renderCostCheck = (request: PurchaseRequest) =>
  request.totalPence !== request.estimatedAmountPence
    ? html`<p class="text-sm">
        <span class="tag tag--yellow">Note</span> The shops add up to
        ${money(request.totalPence)},
        ${request.totalPence > request.estimatedAmountPence
          ? html`more`
          : html`less`}
        than the ${money(request.estimatedAmountPence)} estimate. The shop
        total is what counts against the budget.
      </p>`
    : html``;

export const render = ({
  justSent,
  request,
  purchasingArea,
  submitterName,
}: ViewModel) => {
  const areaName = pipe(
    purchasingArea,
    O.match(
      () => 'a purchasing area that no longer exists',
      summary => summary.name
    )
  );
  // This year's spend as it stood once this request was counted.
  const spendAfter =
    request.spentThisYearPence +
    (countsAgainstBudget(request.outcome) ? request.totalPence : 0);
  const reference = sanitizeString(
    `${request.summary} · ${formatPence(request.totalPence)} · ${areaName}`
  );
  return html`
    <div class="purchase-request purchase-request__sections">
      <div
        class="purchase-confirmation${justSent
          ? html``
          : html` purchase-confirmation--record`}"
      >
        <h1>
          ${justSent ? html`Request sent` : sanitizeString(request.summary)}
        </h1>
        <p>${reference}</p>
      </div>
      <div class="purchase-request__stack">
        <dl class="purchase-summary">
          <dt>Budget</dt>
          <dd>${renderOutcome(request.outcome, request.approval)}</dd>
          <dt>Why</dt>
          <dd>${sanitizeString(request.outcomeReason)}</dd>
          <dt>Area</dt>
          <dd>
            ${pipe(
              purchasingArea,
              O.match(
                () => html`${sanitizeString(areaName)}`,
                summary =>
                  html`<a href="/purchasing-areas/${summary.id}"
                    >${sanitizeString(summary.name)}</a
                  >`
              )
            )}
          </dd>
          <dt>${request.budgetYear} spend</dt>
          <dd>
            ${money(spendAfter)} of ${money(request.yearlyBudgetPence)}
          </dd>
          <dt>Total</dt>
          <dd>${money(request.totalPence)}</dd>
          <dt>First estimate</dt>
          <dd>${money(request.estimatedAmountPence)}</dd>
          <dt>Sent</dt>
          <dd>
            ${displayDate(DateTime.fromJSDate(request.submittedAt))} by
            ${pipe(
              submitterName,
              O.match(
                () => html``,
                name => html`${sanitizeString(name)}`
              )
            )}
            ${renderMemberNumber(request.submittedByMemberNumber)}
          </dd>
          <dt>Why it's needed</dt>
          <dd>${sanitizeString(request.justification)}</dd>
        </dl>
        <table class="purchase-shops-table">
          <thead>
            <tr>
              <th>Shop</th>
              <th>Items</th>
              <th class="purchase-shops-table__cost">Cost</th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(request.purchases.map(renderPurchaseRow))}
          </tbody>
        </table>
        ${renderCostCheck(request)}
        ${request.approval === 'proposal'
          ? html`<p>
              <strong>Next:</strong> write your proposal. Nothing will be bought
              until it is agreed.
            </p>`
          : html`<p>
              The area's other owners and the treasurer can see this request on
              the purchasing page.
            </p>`}
      </div>
    </div>
  `;
};
