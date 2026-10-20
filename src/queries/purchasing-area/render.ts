import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {formatPence} from '../../types/money';
import {
  PurchaseRequest,
  PurchasingArea,
  PurchasingAreaPurchaser,
} from '../../read-models/shared-state/return-types';
import {renderMemberNumber} from '../../templates/member-number';
import {displayDateOnly} from '../../templates/display-date';
import {renderOutcome} from '../../templates/purchase-request-outcome';
import {ViewModel} from './construct-view-model';

const money = (pence: number) => sanitizeString(formatPence(pence));

const query = (params: Record<string, string>) =>
  safe(new URLSearchParams(params).toString().replace(/&/g, '&amp;'));

const renderAreas = (viewModel: ViewModel) => {
  const {purchasingArea, canManage} = viewModel;
  return html`
    <section class="stack">
      <h2>Areas</h2>
      ${purchasingArea.areas.length === 0
        ? html`<p>No areas yet.</p>`
        : html`<ul>
            ${joinHtml(
              purchasingArea.areas.map(
                area => html`<li>
                  <a href="/areas#area-${area.id}"
                    >${sanitizeString(area.name)}</a
                  >
                  ${canManage
                    ? html`-
                        <a
                          href="/purchasing-areas/unassign-area?${query({
                            purchasingArea: purchasingArea.id,
                            area: area.id,
                          })}"
                          >Remove</a
                        >`
                    : html``}
                </li>`
              )
            )}
          </ul>`}
      ${canManage
        ? html`<div>
            <a
              class="button"
              href="/purchasing-areas/assign-area?${query({
                purchasingArea: purchasingArea.id,
              })}"
              >Add area</a
            >
          </div>`
        : html``}
    </section>
  `;
};

const renderBudget = (viewModel: ViewModel) => {
  const {purchasingArea, canManage} = viewModel;
  return html`
    <section class="stack">
      <h2>Budget for ${purchasingArea.budgetYear}</h2>
      <table>
        <tbody>
          <tr>
            <th>Yearly budget</th>
            <td>${money(purchasingArea.yearlyBudgetPence)}</td>
          </tr>
          <tr>
            <th>Spent so far this year</th>
            <td>${money(purchasingArea.spentThisYearPence)}</td>
          </tr>
          <tr>
            <th>Remaining</th>
            <td>${money(purchasingArea.remainingPence)}</td>
          </tr>
        </tbody>
      </table>
      ${canManage
        ? html`<div>
            <a
              class="button"
              href="/purchasing-areas/set-budget?${query({
                purchasingArea: purchasingArea.id,
              })}"
              >Set budget</a
            >
            <a
              class="button"
              href="/purchasing-areas/rename?${query({
                purchasingArea: purchasingArea.id,
              })}"
              >Rename</a
            >
          </div>`
        : html``}
    </section>
  `;
};

const renderPurchaser =
  (purchasingArea: PurchasingArea, canManage: boolean) =>
  (purchaser: PurchasingAreaPurchaser) => html`
    <li>
      ${pipe(
        purchaser.name,
        O.map(sanitizeString),
        O.getOrElseW(() => sanitizeString(purchaser.primaryEmailAddress))
      )}
      ${renderMemberNumber(purchaser.memberNumber)}
      ${purchaser.isOwnerOfAnArea
        ? html``
        : html`<small>(no longer owns any of these areas)</small>`}
      ${canManage
        ? html`-
            <a
              href="/purchasing-areas/remove-purchaser?${query({
                purchasingArea: purchasingArea.id,
                member: purchaser.memberNumber.toString(),
              })}"
              >Remove</a
            >`
        : html``}
    </li>
  `;

const renderPurchasers = (viewModel: ViewModel) => {
  const {purchasingArea, canManage} = viewModel;
  return html`
    <section class="stack">
      <h2>Purchasers</h2>
      <p>Purchasers can submit purchase requests for this purchasing area.</p>
      ${purchasingArea.purchasers.length === 0
        ? html`<p>No purchasers yet.</p>`
        : html`<ul>
            ${joinHtml(
              purchasingArea.purchasers.map(
                renderPurchaser(purchasingArea, canManage)
              )
            )}
          </ul>`}
      ${canManage
        ? html`<div>
            <a
              class="button"
              href="/purchasing-areas/add-purchaser?${query({
                purchasingArea: purchasingArea.id,
              })}"
              >Add purchaser</a
            >
          </div>`
        : html``}
    </section>
  `;
};

const renderRequestRow = (request: PurchaseRequest) => html`
  <tr>
    <td>${displayDateOnly(request.submittedAt)}</td>
    <td>${renderMemberNumber(request.submittedByMemberNumber)}</td>
    <td>
      <a href="/purchase-requests/view/${request.id}"
        >${sanitizeString(request.summary)}</a
      >
    </td>
    <td>${money(request.totalPence)}</td>
    <td>${renderOutcome(request.outcome, request.approval)}</td>
  </tr>
`;

const renderRequests = (viewModel: ViewModel) => html`
  <section class="stack">
    <h2>Purchase requests in ${viewModel.purchasingArea.budgetYear}</h2>
    ${viewModel.canRequest
      ? html`<div>
          <a
            class="button"
            href="/purchase-requests/submit?${query({
              purchasingArea: viewModel.purchasingArea.id,
            })}"
            >Request a purchase</a
          >
        </div>`
      : html``}
    ${viewModel.requests.length === 0
      ? html`<p>None yet this year.</p>`
      : html`<table>
          <thead>
            <tr>
              <th>Submitted</th>
              <th>By</th>
              <th>What</th>
              <th>Cost</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(viewModel.requests.map(renderRequestRow))}
          </tbody>
        </table>`}
  </section>
`;

export const render = (viewModel: ViewModel) => html`
  <div class="stack-large">
    <h1>${sanitizeString(viewModel.purchasingArea.name)}</h1>
    ${renderBudget(viewModel)} ${renderAreas(viewModel)}
    ${renderPurchasers(viewModel)} ${renderRequests(viewModel)}
  </div>
`;
