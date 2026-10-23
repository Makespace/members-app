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
  RecordedSpend,
} from '../../read-models/shared-state/return-types';
import {renderMemberNumber} from '../../templates/member-number';
import {renderMember} from '../../templates/member';
import {displayDateOnly} from '../../templates/display-date';
import {renderOutcome} from '../../templates/purchase-request-outcome';
import {renderStatus} from '../../templates/purchase-request-status';
import {renderRecordPurchaseButton} from '../../templates/record-purchase-button';
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
      ${canManage
        ? superUserActions(html`
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

// Without a name, their email stands in only for those who may see emails;
// everyone else sees just the member number.
const renderPurchaser =
  (purchasingArea: PurchasingArea, canManage: boolean, canSeePrivateDetails: boolean) =>
  (purchaser: PurchasingAreaPurchaser) => html`
    <li>
      ${pipe(
        purchaser.name,
        O.map(sanitizeString),
        O.getOrElseW(() =>
          canSeePrivateDetails
            ? sanitizeString(purchaser.primaryEmailAddress)
            : html``
        )
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
  const {purchasingArea, canManage, canSeePrivateDetails} = viewModel;
  return html`
    <section class="stack">
      <h2>Purchasers</h2>
      <p>
        Owners of its areas can request purchases. Purchasers approve them,
        and can make a purchase themselves when it doesn't need a proposal;
        anything that does goes to the directors. A purchaser who no longer
        owns any of its areas can't do either.
      </p>
      ${purchasingArea.purchasers.length === 0
        ? html`<p>No purchasers yet.</p>`
        : html`<ul>
            ${joinHtml(
              purchasingArea.purchasers.map(
                renderPurchaser(purchasingArea, canManage, canSeePrivateDetails)
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

// This year's spending, as one list: purchase requests (including purchases
// bought directly) and the spending super users recorded before requests
// went through the app.
type SpendingRow =
  | {
      tag: 'request';
      at: Date;
      request: PurchaseRequest;
      submitter: O.Option<Member>;
    }
  | {tag: 'recorded'; at: Date; spend: RecordedSpend};

const spendingRows = (viewModel: ViewModel): ReadonlyArray<SpendingRow> =>
  [
    ...viewModel.requests.map(
      ({request, submitter}): SpendingRow => ({
        tag: 'request',
        at: request.submittedAt,
        request,
        submitter,
      })
    ),
    ...viewModel.purchasingArea.recordedSpend.map(
      (spend): SpendingRow => ({tag: 'recorded', at: spend.recordedAt, spend})
    ),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

const renderSpendingRow = (viewModel: ViewModel) => (row: SpendingRow) => {
  const {canManage, canSeePrivateDetails, purchasingArea} = viewModel;
  if (row.tag === 'request') {
    const {request, submitter} = row;
    return html`
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
        <td>${renderStatus(request)}</td>
        ${canManage ? html`<td></td>` : html``}
      </tr>
    `;
  }
  const {spend} = row;
  return html`
    <tr>
      <td>${displayDateOnly(spend.recordedAt)}</td>
      <td>-</td>
      <td>${sanitizeString(spend.description)}</td>
      <td>${money(spend.amountPence)}</td>
      <td>
        ${spend.kind === 'approved'
          ? renderOutcome('outside-budget', 'none')
          : renderOutcome('budget', 'none')}
      </td>
      <td>
        <span class="tag tag--grey purchase-outcome"
          >Recorded by a super user</span
        >
      </td>
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
  `;
};

const renderSpending = (viewModel: ViewModel) => {
  const rows = spendingRows(viewModel);
  return html`
    <section class="stack">
      <h2>Spending in ${viewModel.purchasingArea.budgetYear}</h2>
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
        : html`<p>
            Purchases are requested by the owners of an area. If something is
            missing or has run out, such as a consumable,
            <a href="/trouble-tickets/raise">raise a trouble ticket</a>.
          </p>`}
      ${viewModel.canBuyDirectly
        ? renderRecordPurchaseButton(viewModel.purchasingArea.id)
        : html``}
      ${rows.length === 0
        ? html`<p>None yet this year.</p>`
        : html`<table>
            <thead>
              <tr>
                <th>Date</th>
                <th>By</th>
                <th>What</th>
                <th>Cost</th>
                <th>Budget</th>
                <th>Status</th>
                ${viewModel.canManage ? html`<th></th>` : html``}
              </tr>
            </thead>
            <tbody>
              ${joinHtml(rows.map(renderSpendingRow(viewModel)))}
            </tbody>
          </table>`}
    </section>
  `;
};

export const render = (viewModel: ViewModel) => html`
  <div class="stack-large">
    <h1>${sanitizeString(viewModel.purchasingArea.name)}</h1>
    ${renderSpending(viewModel)} ${renderBudget(viewModel)}
    ${renderAreas(viewModel)} ${renderPurchasers(viewModel)}
  </div>
`;
