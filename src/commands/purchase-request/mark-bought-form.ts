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
import {
  decisionAction,
  DecisionViewModel,
  purchaseFromParams,
  requestPath,
} from './decide-helpers';

const renderForm = (viewModel: DecisionViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Mark as bought?</h1>
        <p>
          <b>${sanitizeString(viewModel.request.summary)}</b>, approved for
          ${sanitizeString(formatPence(viewModel.request.totalPence))}.
        </p>
        <form
          action="${safe(decisionAction('mark-bought', viewModel.request.id))}"
          method="post"
        >
          <label for="actualCost">What did it cost?</label>
          <p class="text-sm">
            Change it if the real cost was different, e.g. with delivery.
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
              required
            />
          </div>
          <input type="hidden" name="id" value="${viewModel.request.id}" />
          <button type="submit">Mark as bought</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Mark as bought'), {
      href: requestPath(viewModel.request.id),
      label: viewModel.request.summary,
    })
  );

export const markBoughtForm: Form<DecisionViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel, user}) =>
      TE.fromEither(purchaseFromParams(readModel, input, user)),
  // Checked against the request itself, in purchaseFromParams.
  formIsAuthorized: null,
};
