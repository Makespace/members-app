import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {formatPence} from '../../types/money';
import {renderRemaining} from '../../templates/remaining-budget';
import {
  Member,
  PurchaseRequest,
  PurchasingArea,
  PurchasingAreaPurchaser,
} from '../../read-models/shared-state/return-types';
import {renderMemberNumber} from '../../templates/member-number';
import {renderMember} from '../../templates/member';
import {displayDateOnly} from '../../templates/display-date';
import {renderOutcome} from '../../templates/purchase-request-outcome';
import {renderStatus} from '../../templates/purchase-request-status';
import {
  superUserActions,
  superUserButton,
  superUserLink,
} from '../../templates/super-user';
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
                        ${superUserLink(
                          `/purchasing-areas/unassign-area?${query({
                            purchasingArea: purchasingArea.id,
                            area: area.id,
                          })}`,
                          html`Remove`
                        )}`
                    : html``}
                </li>`
              )
            )}
          </ul>`}
      ${canManage
        ? superUserActions(
            superUserButton(
              `/purchasing-areas/assign-area?${query({
                purchasingArea: purchasingArea.id,
              })}`,
              html`Add area`
            )
          )
        : html``}
    </section>
  `;
};

// Spending super users recorded directly, rather than through requests.
const renderRecordedSpend = (
  purchasingArea: PurchasingArea,
  canManage: boolean
) =>
  purchasingArea.recordedSpend.length === 0
    ? html``
    : html`
        <h3>Recorded spending</h3>
        <table>
          <thead>
            <tr>
              <th>Recorded</th>
              <th>What it was for</th>
              <th>Budget</th>
              <th>Amount</th>
              ${canManage ? html`<th></th>` : html``}
            </tr>
          </thead>
          <tbody>
            ${joinHtml(
              purchasingArea.recordedSpend.map(
                spend => html`
                  <tr>
                    <td>${displayDateOnly(spend.recordedAt)}</td>
                    <td>${sanitizeString(spend.description)}</td>
                    <td>
                      ${spend.kind === 'approved'
                        ? html`Approved, outside the budget`
                        : html`Yearly budget`}
                    </td>
                    <td>${money(spend.amountPence)}</td>
                    ${canManage
                      ? html`<td>
                          ${superUserLink(
                            `/purchasing-areas/remove-spend?${query({
                              purchasingArea: purchasingArea.id,
                              spend: spend.id,
                            })}`,
                            html`Remove`
                          )}
                        </td>`
                      : html``}
                  </tr>
                `
              )
            )}
          </tbody>
        </table>
      `;

const renderBudget = (viewModel: ViewModel) => {
  const {purchasingArea, canManage} = viewModel;
  return html`
    <section class="stack">
      <h2>Budget for ${purchasingArea.budgetYear}</h2>
      <table>
        <tbody>
          <tr>
            <th>Yearly budget</th>
            <td>
              ${money(purchasingArea.yearlyBudgetPence)}
              ${purchasingArea.yearlyBudgetPence !==
              purchasingArea.usualBudgetPence
                ? html`<span class="text-gray"
                    >(usually ${money(purchasingArea.usualBudgetPence)})</span
                  >`
                : html``}
            </td>
          </tr>
          <tr>
            <th>Spent so far this year</th>
            <td>${money(purchasingArea.spentThisYearPence)}</td>
          </tr>
          <tr>
            <th>Remaining</th>
            <td>${renderRemaining(purchasingArea.remainingPence)}</td>
          </tr>
          ${purchasingArea.awaitingApprovalPence > 0
            ? html`<tr>
                <th>Requests awaiting approval</th>
                <td>${money(purchasingArea.awaitingApprovalPence)}</td>
              </tr>`
            : html``}
          ${purchasingArea.approvedSpendThisYearPence > 0
            ? html`<tr>
                <th>Approved spending (outside the budget)</th>
                <td>${money(purchasingArea.approvedSpendThisYearPence)}</td>
              </tr>`
            : html``}
        </tbody>
      </table>
      ${renderRecordedSpend(purchasingArea, canManage)}
      ${canManage
        ? superUserActions(html`
            ${superUserButton(
              `/purchasing-areas/record-spend?${query({
                purchasingArea: purchasingArea.id,
              })}`,
              html`Record spending`
            )}
            ${superUserButton(
              `/purchasing-areas/set-year-budget?${query({
                purchasingArea: purchasingArea.id,
              })}`,
              html`Set ${purchasingArea.budgetYear}'s budget`
            )}
            ${superUserButton(
              `/purchasing-areas/set-budget?${query({
                purchasingArea: purchasingArea.id,
              })}`,
              html`Set usual budget`
            )}
            ${superUserButton(
              `/purchasing-areas/rename?${query({
                purchasingArea: purchasingArea.id,
              })}`,
              html`Rename`
            )}
          `)
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
            ${superUserLink(
              `/purchasing-areas/remove-purchaser?${query({
                purchasingArea: purchasingArea.id,
                member: purchaser.memberNumber.toString(),
              })}`,
              html`Remove`
            )}`
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
        ? superUserActions(
            superUserButton(
              `/purchasing-areas/add-purchaser?${query({
                purchasingArea: purchasingArea.id,
              })}`,
              html`Add purchaser`
            )
          )
        : html``}
    </section>
  `;
};

const renderSubmitter = (
  request: PurchaseRequest,
  submitter: O.Option<Member>,
  canSeePrivateDetails: boolean
) =>
  pipe(
    submitter,
    O.match(
      () => renderMemberNumber(request.submittedByMemberNumber),
      member => renderMember(member, canSeePrivateDetails)
    )
  );

const renderRequestRow =
  (canSeePrivateDetails: boolean) =>
  ({
    request,
    submitter,
  }: {
    request: PurchaseRequest;
    submitter: O.Option<Member>;
  }) => html`
  <tr>
    <td>${displayDateOnly(request.submittedAt)}</td>
    <td>${renderSubmitter(request, submitter, canSeePrivateDetails)}</td>
    <td>
      <a href="/purchase-requests/view/${request.id}"
        >${sanitizeString(request.summary)}</a
      >
    </td>
    <td>${money(request.totalPence)}</td>
    <td>${renderOutcome(request.outcome, request.approval)}</td>
    <td>${renderStatus(request.status)}</td>
  </tr>
`;

const renderRequests = (viewModel: ViewModel) => html`
  <section class="stack">
    <h2>Purchase requests in ${viewModel.purchasingArea.budgetYear}</h2>
    <div>
      <a
        class="button"
        href="/purchase-requests/submit?${query({
          purchasingArea: viewModel.purchasingArea.id,
        })}"
        >Request a purchase</a
      >
    </div>
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
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(
              viewModel.requests.map(
                renderRequestRow(viewModel.canSeePrivateDetails)
              )
            )}
          </tbody>
        </table>`}
  </section>
`;

export const render = (viewModel: ViewModel) => html`
  <div class="stack-large">
    <h1>${sanitizeString(viewModel.purchasingArea.name)}</h1>
    ${renderRequests(viewModel)} ${renderBudget(viewModel)}
    ${renderAreas(viewModel)} ${renderPurchasers(viewModel)}
  </div>
`;
