import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Form} from '../../types/form';
import {
  html,
  safe,
  sanitizeString,
  toLoggedInContentWithBackLink,
} from '../../types/html';
import {formatPence} from '../../types/money';
import {countsAgainstBudget} from '../../purchasing/budget-year';
import {renderOutcome} from '../../templates/purchase-request-outcome';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
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
          <input type="hidden" name="id" value="${viewModel.request.id}" />
          <button type="submit">Approve</button>
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
    ({readModel}) =>
      TE.fromEither(decisionFromParams(readModel, input)),
  formIsAuthorized: isAdminOrSuperUser,
};
