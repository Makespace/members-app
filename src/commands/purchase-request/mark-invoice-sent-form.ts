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
import * as O from 'fp-ts/Option';
import {
  decisionAction,
  DecisionViewModel,
  invoiceFromParams,
  requestPath,
} from './decide-helpers';

const renderForm = (viewModel: DecisionViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Invoice sent to the accountants?</h1>
        <p>
          <b>${sanitizeString(viewModel.request.summary)}</b>, bought for
          ${sanitizeString(
            formatPence(
              O.getOrElse(() => viewModel.request.totalPence)(
                viewModel.request.actualCostPence
              )
            )
          )}.
        </p>
        <p>
          Once you've passed its invoice on to the accountants, mark it here
          so it's off your list and everyone can see it's done.
        </p>
        <form
          action="${safe(decisionAction('mark-invoice-sent', viewModel.request.id))}"
          method="post"
        >
          <input type="hidden" name="id" value="${viewModel.request.id}" />
          <button type="submit">Mark invoice as sent</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Invoice sent'), {
      href: requestPath(viewModel.request.id),
      label: viewModel.request.summary,
    })
  );

export const markInvoiceSentForm: Form<DecisionViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel, user}) =>
      TE.fromEither(invoiceFromParams(readModel, input, user)),
  // Checked against the request itself, in invoiceFromParams.
  formIsAuthorized: null,
};
