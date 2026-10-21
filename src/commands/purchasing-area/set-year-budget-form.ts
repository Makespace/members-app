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

const money = (pence: number) => sanitizeString(formatPence(pence));

const renderForm = (purchasingArea: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>
          Set ${purchasingArea.budgetYear}'s budget for
          ${sanitizeString(purchasingArea.name)}
        </h1>
        <p>
          For this year only, e.g. to extend it. The usual budget is
          ${money(purchasingArea.usualBudgetPence)} a year, and applies again
          next year; set this year's back to that to undo a change.
          ${money(purchasingArea.spentThisYearPence)} has been spent so far in
          ${purchasingArea.budgetYear}.
        </p>
        <form
          action="${safe(actionReturningTo('set-year-budget', purchasingArea.id))}"
          method="post"
        >
          <label for="yearlyBudget"
            >${purchasingArea.budgetYear} budget (£)</label
          >
          <input
            type="text"
            inputmode="decimal"
            name="yearlyBudget"
            id="yearlyBudget"
            value="${safe((purchasingArea.yearlyBudgetPence / 100).toFixed(2))}"
            required
          />
          <input
            type="hidden"
            name="purchasingAreaId"
            value="${purchasingArea.id}"
          />
          <button type="submit">Set ${purchasingArea.budgetYear}'s budget</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe("Set this year's budget"), {
      href: purchasingAreaPath(purchasingArea.id),
      label: purchasingArea.name,
    })
  );

export const setYearBudgetForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel}) =>
      TE.fromEither(purchasingAreaFromParams(readModel, input)),
  formIsAuthorized: isAdminOrSuperUser,
};
