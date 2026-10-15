import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {formatPence} from '../../types/money';
import {
  PurchaseRequest,
  PurchaseRequestPurchase,
  PurchasingAreaSummary,
} from '../../read-models/shared-state/return-types';
import {renderMemberNumber} from '../../templates/member-number';
import {displayDate} from '../../templates/display-date';
import {renderOutcome} from '../../templates/purchase-request-outcome';
import {DateTime} from 'luxon';

type ViewModel = {
  request: PurchaseRequest;
  purchasingArea: O.Option<PurchasingAreaSummary>;
  submitterName: O.Option<string>;
};

const money = (pence: number) => sanitizeString(formatPence(pence));

const yesNo = (value: boolean | null) =>
  value === null ? html`<small>Not asked</small>` : safe(value ? 'Yes' : 'No');

const isWebLink = (link: string) => /^https?:\/\//i.test(link);

const renderLink = (link: O.Option<string>) =>
  pipe(
    link,
    O.match(
      () => html`<small>No link given</small>`,
      url =>
        isWebLink(url)
          ? html`<a href="${sanitizeString(url)}" rel="noreferrer" target="_blank"
              >${sanitizeString(url)}</a
            >`
          : sanitizeString(url)
    )
  );

const renderPurchase = (purchase: PurchaseRequestPurchase) => html`
  <article class="stack">
    <h3>${sanitizeString(purchase.shop)}</h3>
    <p>${renderLink(purchase.link)}</p>
    <p style="white-space: pre-line">${sanitizeString(purchase.items)}</p>
    ${pipe(
      purchase.costPence,
      O.match(
        () => html``,
        cost => html`<p>Cost: ${money(cost)}</p>`
      )
    )}
  </article>
`;

const renderPurchases = (request: PurchaseRequest) => {
  const costs = request.purchases.flatMap(purchase =>
    O.isSome(purchase.costPence) ? [purchase.costPence.value] : []
  );
  const total = costs.reduce((sum, cost) => sum + cost, 0);
  return html`
    <section class="stack">
      <h2>What to buy</h2>
      ${joinHtml(request.purchases.map(renderPurchase))}
      ${costs.length > 0 && total !== request.estimatedAmountPence
        ? html`<p>
            <small
              >The shop costs add up to ${money(total)}, not the estimated
              ${money(request.estimatedAmountPence)}. The estimate is what
              counts against the budget.</small
            >
          </p>`
        : html``}
    </section>
  `;
};

export const render = ({request, purchasingArea, submitterName}: ViewModel) => html`
  <div class="stack-large">
    <h1>${sanitizeString(request.summary)}</h1>
    <section class="stack">
      <p>${renderOutcome(request.outcome, request.approval)}</p>
      <p>${sanitizeString(request.outcomeReason)}</p>
    </section>
    <table>
      <tbody>
        <tr>
          <th>Purchasing area</th>
          <td>
            ${pipe(
              purchasingArea,
              O.match(
                () => html`<small>No longer exists</small>`,
                summary =>
                  html`<a href="/purchasing-areas/${summary.id}"
                    >${sanitizeString(summary.name)}</a
                  >`
              )
            )}
          </td>
        </tr>
        <tr>
          <th>Estimated total</th>
          <td>${money(request.estimatedAmountPence)}</td>
        </tr>
        <tr>
          <th>Submitted</th>
          <td>
            ${displayDate(DateTime.fromJSDate(request.submittedAt))} by
            ${pipe(
              submitterName,
              O.match(
                () => html``,
                name => html`${sanitizeString(name)}`
              )
            )}
            ${renderMemberNumber(request.submittedByMemberNumber)}
          </td>
        </tr>
        <tr>
          <th>Why it is needed</th>
          <td>${sanitizeString(request.justification)}</td>
        </tr>
        <tr>
          <th>Consumable members pay for at point of use?</th>
          <td>${yesNo(request.isMemberPaidConsumable)}</td>
        </tr>
        <tr>
          <th>Budget when submitted</th>
          <td>
            ${money(request.spentThisYearPence)} already spent from the budget in
            ${request.budgetYear}, against a yearly budget of
            ${money(request.yearlyBudgetPence)}
          </td>
        </tr>
      </tbody>
    </table>
    ${renderPurchases(request)}
  </div>
`;
