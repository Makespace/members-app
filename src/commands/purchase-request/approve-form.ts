import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Form} from '../../types/form';
import {REASON_MAX} from '../../types/limited-text';
import {
  html,
  safe,
  sanitizeString,
  toLoggedInContentWithBackLink,
} from '../../types/html';
import {formatPence} from '../../types/money';
import {countsAgainstBudget} from '../../purchasing/budget-year';
import {renderOutcome} from '../../templates/purchase-request-outcome';
import {
  decisionAction,
  decisionFromParams,
  DecisionViewModel,
  requestPath,
} from './decide-helpers';

const money = (pence: number) => sanitizeString(formatPence(pence));

// What approving would do to the area's budget as it stands now.
const renderBudgetEffect = ({request, purchasingArea}: DecisionViewModel) =>
  countsAgainstBudget(request.outcome)
    ? pipe(
        purchasingArea,
        O.match(
          () => html``,
          area => html`<p>
            Approving it takes ${sanitizeString(area.name)}'s
            ${area.budgetYear} spending from ${money(area.spentThisYearPence)}
            to
            <strong
              >${money(area.spentThisYearPence + request.totalPence)}</strong
            >
            of its ${money(area.yearlyBudgetPence)} budget.
          </p>`
        )
      )
    : html`<p>Members pay for this, so it doesn't use up the budget.</p>`;

const renderForm = (viewModel: DecisionViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Approve this purchase request?</h1>
        <p>
          <b>${sanitizeString(viewModel.request.summary)}</b>,
          ${money(viewModel.request.totalPence)}
          ${renderOutcome(viewModel.request.outcome, viewModel.request.approval)}
        </p>
        <p>${sanitizeString(viewModel.request.outcomeReason)}</p>
        ${renderBudgetEffect(viewModel)}
        <form
          action="${safe(decisionAction('approve', viewModel.request.id))}"
          method="post"
        >
          <label for="note"
            >${viewModel.request.approval === 'proposal'
              ? html`What was agreed?`
              : html`Note (optional)`}</label
          >
          <p class="text-sm">
            Everyone who heard about this request is told, with this note.
            ${viewModel.request.approval === 'proposal'
              ? html`For example: "Agreed at the October owners' forum, with
                  the Metal Shop owners."`
              : html``}
          </p>
          <textarea
            name="note"
            id="note"
            rows="3"
            maxlength="${REASON_MAX}"
            ${viewModel.request.approval === 'proposal'
              ? html`required`
              : html``}
          ></textarea>
          <label for="actualCost">If you've bought it, what did it cost?</label>
          <p class="text-sm">
            Only used with "Approve and mark as bought". Change it if the real
            cost was different, e.g. with delivery.
          </p>
          <div class="purchase-money purchase-money--narrow">
            <span>£</span
            ><input
              type="text"
              inputmode="decimal"
              name="actualCost"
              id="actualCost"
              pattern="[0-9]+([.][0-9]{1,2})?"
              title="An amount in pounds, e.g. 42.50"
              value="${sanitizeString((viewModel.request.totalPence / 100).toFixed(2))}"
            />
          </div>
          <input type="hidden" name="id" value="${viewModel.request.id}" />
          <div class="wrap">
            <button type="submit" name="markBought" value="false">
              Approve
            </button>
            <button type="submit" name="markBought" value="true">
              Approve and mark as bought
            </button>
          </div>
          <p class="text-sm">
            Approve it for someone to buy, or, if you've already bought it,
            approve it and mark it as bought.
          </p>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Approve purchase request'), {
      href: requestPath(viewModel.request.id),
      label: viewModel.request.summary,
    })
  );

export const approveForm: Form<DecisionViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel, user}) =>
      TE.fromEither(decisionFromParams(readModel, input, user)),
  // Checked against the request itself, in decisionFromParams.
  formIsAuthorized: null,
};
