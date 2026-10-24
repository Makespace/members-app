import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {html, safe, sanitizeString} from '../../types/html';
import {formatPence} from '../../types/money';
import {
  PurchaseRequest,
  PurchasingAreaSummary,
} from '../../read-models/shared-state/return-types';
import {renderPurchaseBreakdown} from '../../templates/purchase-breakdown';
import {renderProposal} from '../../templates/proposal';
import {renderMemberNumber} from '../../templates/member-number';
import {displayDate} from '../../templates/display-date';
import {
  renderOutcome,
  renderSuperUserOverride,
} from '../../templates/purchase-request-outcome';
import {countsAgainstBudget} from '../../purchasing/budget-year';
import {renderStatus} from '../../templates/purchase-request-status';
import {superUserActions, superUserButton} from '../../templates/super-user';
import {awaitedApproval} from '../../templates/purchase-request-status';

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
  // Who marked it bought, once someone has.
  buyerName: O.Option<string>;
};

const money = (pence: number) => sanitizeString(formatPence(pence));

// Once approved: bought, or still to buy.
const renderBought = (request: PurchaseRequest, buyerName: O.Option<string>) =>
  request.status === 'bought'
    ? html`<p>
        <strong>Bought</strong>
        ${pipe(
          buyerName,
          O.match(
            () => html``,
            name => html`by ${sanitizeString(name)}`
          )
        )}
        ${pipe(
          request.boughtAt,
          O.match(
            () => html``,
            at => html`on ${displayDate(DateTime.fromJSDate(at))}`
          )
        )}${pipe(
          request.actualCostPence,
          O.match(
            () => html`.`,
            cost => html`, for ${money(cost)}.`
          )
        )}
      </p>`
    : html`<p>
        <strong>Next:</strong> one of the area's purchasers (or a super user)
        buys it and marks it as bought.
      </p>`;

const renderDecision = (
  request: PurchaseRequest,
  deciderName: O.Option<string>,
  submitterName: O.Option<string>,
  buyerName: O.Option<string>
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
    case 'bought':
      return html`<p>
        <strong>Approved</strong> (${safe(awaitedApproval(request))}
        approval) ${by}${pipe(
          request.approvalNote,
          O.match(
            () => html`.`,
            note => html`: ${sanitizeString(note)}`
          )
        )}
      </p>
      ${renderBought(request, buyerName)}`;
    case 'declined':
      return html`<p><strong>Declined</strong> ${by}:
          ${sanitizeString(
            O.getOrElse(() => '')(request.declineReason)
          )}</p>`;
    // Bought for Makespace, not by someone who then claims it back.
    case 'bought-directly':
      return html`<p>
        <strong>Bought directly</strong> by
        ${pipe(
          submitterName,
          O.match(
            () => renderMemberNumber(request.submittedByMemberNumber),
            name => html`${sanitizeString(name)}`
          )
        )}
        on Makespace's behalf (e.g. with Capital on Tap)${request.approval ===
        'proposal'
          ? html`. As a super user, they went ahead without the proposal it
              would otherwise need.`
          : html`, so it didn't need approving.`}
      </p>`;
    case 'awaiting-approval':
      return html`<p>
        <strong>Next:</strong>
        ${request.approval === 'proposal'
          ? html`a director needs to approve this request and its proposal.`
          : html`one of the area's purchasers (or a director) needs to approve
            this request.`}
        Nothing will be bought until they do, and it doesn't count against
        the budget until then.
      </p>`;
  }
};

const renderDecide = (request: PurchaseRequest) =>
  superUserActions(
    html`
    ${superUserButton(
      `/purchase-requests/approve?request=${request.id}`,
      html`Approve`
    )}
    ${superUserButton(
      `/purchase-requests/decline?request=${request.id}`,
      html`Decline`
    )}
  `,
    awaitedApproval(request) === 'director'
      ? 'Super users only'
      : 'Purchasers and super users'
  );

export const render = ({
  justSent,
  request,
  purchasingArea,
  submitterName,
  deciderName,
  canDecide,
  buyerName,
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
  const boughtDirectly = request.status === 'bought-directly';
  return html`
    <div class="purchase-request purchase-request__sections">
      <div
        class="purchase-confirmation${justSent
          ? html``
          : html` purchase-confirmation--record`}"
      >
        <h1>
          ${justSent
            ? request.status === 'bought-directly'
              ? html`Purchase recorded`
              : html`Request sent`
            : sanitizeString(request.summary)}
        </h1>
        <p>${reference}</p>
      </div>
      <div class="purchase-request__stack">
        <dl class="purchase-summary">
          <dt>Status</dt>
          <dd>${renderStatus(request)}</dd>
          <dt>Budget</dt>
          <dd>
            ${renderOutcome(request.outcome, request.approval, request.status)}
            ${request.status === 'bought-directly' &&
            request.approval === 'proposal'
              ? renderSuperUserOverride()
              : html``}
          </dd>
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
            it stood when ${boughtDirectly ? html`recorded` : html`sent`}
          </dd>
          <dt>Total</dt>
          <dd>${money(request.totalPence)}</dd>
          <dt>${boughtDirectly ? html`Recorded` : html`Sent`}</dt>
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
        ${request.purchases.length > 0
          ? renderPurchaseBreakdown(request.purchases, request.totalPence)
          : html``}
        ${pipe(
          request.proposal,
          O.match(() => html``, renderProposal)
        )}
        ${renderDecision(request, deciderName, submitterName, buyerName)}
        ${canDecide && request.status === 'awaiting-approval'
          ? renderDecide(request)
          : html``}
        ${canDecide && request.status === 'approved'
          ? superUserActions(
              superUserButton(
                `/purchase-requests/mark-bought?request=${request.id}`,
                html`Mark as bought`
              ),
              awaitedApproval(request) === 'director'
                ? 'Super users only'
                : 'Purchasers and super users'
            )
          : html``}
      </div>
    </div>
  `;
};
