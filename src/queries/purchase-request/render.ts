import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {html, sanitizeString} from '../../types/html';
import {formatPence} from '../../types/money';
import {
  PurchaseRequest,
  PurchasingAreaSummary,
} from '../../read-models/shared-state/return-types';
import {renderPurchaseBreakdown} from '../../templates/purchase-breakdown';
import {renderProposal} from '../../templates/proposal';
import {renderMemberNumber} from '../../templates/member-number';
import {displayDate} from '../../templates/display-date';
import {renderOutcome} from '../../templates/purchase-request-outcome';
import {countsAgainstBudget} from '../../purchasing/budget-year';
import {renderStatus} from '../../templates/purchase-request-status';
import {superUserActions, superUserButton} from '../../templates/super-user';

type ViewModel = {
  // Straight after submitting: shown as the confirmation of a sent request.
  justSent: boolean;
  request: PurchaseRequest;
  purchasingArea: O.Option<PurchasingAreaSummary>;
  submitterName: O.Option<string>;
  // Who approved or declined it, once someone has.
  deciderName: O.Option<string>;
  // Super users approve or decline requests.
  canDecide: boolean;
};

const money = (pence: number) => sanitizeString(formatPence(pence));

const renderDecision = (
  request: PurchaseRequest,
  deciderName: O.Option<string>
) => {
  const by = html`${pipe(
    deciderName,
    O.match(
      () => html``,
      name => html`by ${sanitizeString(name)}`
    )
  )}
  ${pipe(
    request.decidedAt,
    O.match(
      () => html``,
      decidedAt => html`on ${displayDate(DateTime.fromJSDate(decidedAt))}`
    )
  )}`;
  switch (request.status) {
    case 'approved':
      return html`<p><strong>Approved</strong> ${by}.</p>`;
    case 'declined':
      return html`<p><strong>Declined</strong> ${by}:
          ${sanitizeString(
            O.getOrElse(() => '')(request.declineReason)
          )}</p>`;
    case 'awaiting-approval':
      return html`<p>
        <strong>Next:</strong> a director needs to approve this
        request${request.approval === 'proposal' ? html` and its proposal` : html``}.
        Nothing will be bought until they do, and it doesn't count against
        the budget until then.
      </p>`;
  }
};

const renderDecide = (request: PurchaseRequest) =>
  superUserActions(html`
    ${superUserButton(
      `/purchase-requests/approve?request=${request.id}`,
      html`Approve`
    )}
    ${superUserButton(
      `/purchase-requests/decline?request=${request.id}`,
      html`Decline`
    )}
  `);

export const render = ({
  justSent,
  request,
  purchasingArea,
  submitterName,
  deciderName,
  canDecide,
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
          <dt>Status</dt>
          <dd>${renderStatus(request.status)}</dd>
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
          <dt>${request.budgetYear} spend with this</dt>
          <dd>
            ${money(spendAfter)} of ${money(request.yearlyBudgetPence)}, as
            it stood when sent
          </dd>
          <dt>Total</dt>
          <dd>${money(request.totalPence)}</dd>
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
        ${renderPurchaseBreakdown(request.purchases, request.totalPence)}
        ${pipe(
          request.proposal,
          O.match(() => html``, renderProposal)
        )}
        ${renderDecision(request, deciderName)}
        ${canDecide && request.status === 'awaiting-approval'
          ? renderDecide(request)
          : html``}
      </div>
    </div>
  `;
};
