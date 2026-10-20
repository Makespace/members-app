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

type ViewModel = {
  // Straight after submitting: shown as the confirmation of a sent request.
  justSent: boolean;
  request: PurchaseRequest;
  purchasingArea: O.Option<PurchasingAreaSummary>;
  submitterName: O.Option<string>;
};

const money = (pence: number) => sanitizeString(formatPence(pence));

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
        ${request.approval === 'proposal'
          ? O.isSome(request.proposal)
            ? html`<p>
                <strong>Next:</strong> the proposal needs agreeing. Nothing will
                be bought until it is.
              </p>`
            : html`<p>
                <strong>Next:</strong> write your proposal. Nothing will be
                bought until it is agreed.
              </p>`
          : html`<p>
              The area's other owners and the treasurer can see this request on
              the purchasing page.
            </p>`}
      </div>
    </div>
  `;
};
