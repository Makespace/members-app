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
import {PurchasingArea} from '../../read-models/shared-state/return-types';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {
  actionReturningTo,
  purchasingAreaFromParams,
  purchasingAreaPath,
} from './helpers';

type ViewModel = PurchasingArea;

const renderForm = (purchasingArea: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Set the usual yearly budget for ${sanitizeString(purchasingArea.name)}</h1>
        <p>
          Usually ${sanitizeString(formatPence(purchasingArea.usualBudgetPence))}
          a year. The budget runs for the calendar year; a change applies to
          this year straight away${purchasingArea.yearlyBudgetPence !==
          purchasingArea.usualBudgetPence
            ? html`, except that ${purchasingArea.budgetYear} has its own
                budget of
                ${sanitizeString(formatPence(purchasingArea.yearlyBudgetPence))}`
            : html``}.
        </p>
        <form
          action="${safe(actionReturningTo('set-budget', purchasingArea.id))}"
          method="post"
        >
          <label for="yearlyBudget">Yearly budget (£)</label>
          <input
            type="text"
            inputmode="decimal"
            name="yearlyBudget"
            id="yearlyBudget"
            value="${safe((purchasingArea.usualBudgetPence / 100).toFixed(2))}"
            required
          />
          <input
            type="hidden"
            name="purchasingAreaId"
            value="${purchasingArea.id}"
          />
          <button type="submit">Set budget</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Set budget'), {
      href: purchasingAreaPath(purchasingArea.id),
      label: purchasingArea.name,
    })
  );

export const setBudgetForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel}) =>
      TE.fromEither(purchasingAreaFromParams(readModel, input)),
  formIsAuthorized: isAdminOrSuperUser,
};
