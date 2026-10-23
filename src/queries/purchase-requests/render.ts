import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, sanitizeString} from '../../types/html';
import {formatPence} from '../../types/money';
import {
  Member,
  PurchaseRequest,
} from '../../read-models/shared-state/return-types';
import {displayDateOnly} from '../../templates/display-date';
import {renderMember} from '../../templates/member';
import {renderMemberNumber} from '../../templates/member-number';
import {renderOutcome} from '../../templates/purchase-request-outcome';
import {renderStatus} from '../../templates/purchase-request-status';

type Row = {
  request: PurchaseRequest;
  areaName: O.Option<string>;
  submitter: O.Option<Member>;
};

type ViewModel = {
  requests: ReadonlyArray<Row>;
  // Email addresses, as elsewhere, for super users and area owners only.
  canSeePrivateDetails: boolean;
  // Those awaiting approval they can approve or decline: their to-dos,
  // which drop off once decided.
  waitingForViewer: ReadonlyArray<Row>;
  canRequest: boolean;
};

const renderRow =
  (canSeePrivateDetails: boolean) =>
  ({request, areaName, submitter}: Row) => html`
    <tr>
      <td>${displayDateOnly(request.submittedAt)}</td>
      <td>
        ${pipe(
          areaName,
          O.match(
            () => html`-`,
            name => html`<a href="/purchasing-areas/${request.purchasingAreaId}"
              >${sanitizeString(name)}</a
            >`
          )
        )}
      </td>
      <td>
        ${pipe(
          submitter,
          O.match(
            () => renderMemberNumber(request.submittedByMemberNumber),
            member => renderMember(member, canSeePrivateDetails)
          )
        )}
      </td>
      <td>
        <a href="/purchase-requests/view/${request.id}"
          >${sanitizeString(request.summary)}</a
        >
      </td>
      <td>${sanitizeString(formatPence(request.totalPence))}</td>
      <td>${renderOutcome(request.outcome, request.approval)}</td>
      <td>${renderStatus(request)}</td>
    </tr>
  `;

const renderTable = (rows: ReadonlyArray<Row>, canSeePrivateDetails: boolean) =>
  html`<table>
    <thead>
      <tr>
        <th>Sent</th>
        <th>Area</th>
        <th>By</th>
        <th>What</th>
        <th>Cost</th>
        <th>Budget</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${joinHtml(rows.map(renderRow(canSeePrivateDetails)))}
    </tbody>
  </table>`;

export const render = (viewModel: ViewModel) => {
  // Oldest first, so the longest-waiting get seen to first.
  const awaiting = viewModel.requests
    .filter(({request}) => request.status === 'awaiting-approval')
    .reverse();
  const decided = viewModel.requests.filter(
    ({request}) => request.status !== 'awaiting-approval'
  );
  return html`
    <div class="stack-large">
      <div class="stack">
        <h1>Purchase requests</h1>
        <div class="wrap">
          ${viewModel.canRequest
            ? html`<a class="button" href="/purchase-requests/submit"
                >Request a purchase</a
              >`
            : html``}
          <a href="/purchasing-areas">Purchasing areas</a>
        </div>
      </div>
      ${viewModel.waitingForViewer.length > 0
        ? html`<section class="stack">
            <h2>Waiting for you (${viewModel.waitingForViewer.length})</h2>
            <p>You can approve or decline these.</p>
            ${renderTable(
              [...viewModel.waitingForViewer].reverse(),
              viewModel.canSeePrivateDetails
            )}
          </section>`
        : html``}
      <section class="stack">
        <h2>Awaiting approval (${awaiting.length})</h2>
        ${viewModel.waitingForViewer.length > 0
          ? html`<p>
              Open a request to approve or decline it.
            </p>`
          : html``}
        ${awaiting.length === 0
          ? html`<p>Nothing is waiting for approval.</p>`
          : renderTable(awaiting, viewModel.canSeePrivateDetails)}
      </section>
      <section class="stack">
        <h2>Approved, bought directly or declined</h2>
        ${decided.length === 0
          ? html`<p>None yet.</p>`
          : renderTable(decided, viewModel.canSeePrivateDetails)}
      </section>
    </div>
  `;
};
