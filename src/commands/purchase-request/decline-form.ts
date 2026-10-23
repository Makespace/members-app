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
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {
  decisionAction,
  decisionFromParams,
  DecisionViewModel,
  requestPath,
} from './decide-helpers';

const renderForm = (viewModel: DecisionViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Decline this purchase request?</h1>
        <p>
          <b>${sanitizeString(viewModel.request.summary)}</b>,
          ${sanitizeString(formatPence(viewModel.request.totalPence))}
        </p>
        <form
          action="${safe(decisionAction('decline', viewModel.request.id))}"
          method="post"
        >
          <label for="reason">Why is it being declined?</label>
          <textarea
            name="reason"
            id="reason"
            rows="4"
            maxlength="${REASON_MAX}"
            required
          ></textarea>
          <input type="hidden" name="id" value="${viewModel.request.id}" />
          <button type="submit">Decline</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Decline purchase request'), {
      href: requestPath(viewModel.request.id),
      label: viewModel.request.summary,
    })
  );

export const declineForm: Form<DecisionViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel}) =>
      TE.fromEither(decisionFromParams(readModel, input)),
  formIsAuthorized: isAdminOrSuperUser,
};
