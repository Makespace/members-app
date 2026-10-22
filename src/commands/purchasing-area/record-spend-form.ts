import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {v4} from 'uuid';
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
        <h1>Record spending for ${sanitizeString(purchasingArea.name)}</h1>
        <p>
          Spending in ${purchasingArea.budgetYear} that didn't come through a
          purchase request. ${money(purchasingArea.spentThisYearPence)} of
          ${money(purchasingArea.yearlyBudgetPence)} of the yearly budget has
          been spent so far.
        </p>
        <form
          action="${safe(actionReturningTo('record-spend', purchasingArea.id))}"
          method="post"
        >
          <label for="amount">Amount (£)</label>
          <input
            type="text"
            inputmode="decimal"
            name="amount"
            id="amount"
            placeholder="0.00"
            required
          />
          <label for="description">What was it for?</label>
          <input
            type="text"
            name="description"
            id="description"
            placeholder="e.g. Extraction repair, approved by the directors"
            required
          />
          <fieldset class="mb-6">
            <legend>Does it come out of the yearly budget?</legend>
            <div class="fieldset-item">
              <input
                type="radio"
                name="kind"
                id="kind-budget"
                value="budget"
                required
              />
              <label for="kind-budget"
                >Yes - e.g. what was spent before purchase requests were in the
                app</label
              >
            </div>
            <div class="fieldset-item">
              <input
                type="radio"
                name="kind"
                id="kind-approved"
                value="approved"
                required
              />
              <label for="kind-approved"
                >No - approved spending outside the budget, e.g. approved by
                the directors</label
              >
            </div>
          </fieldset>
          <input
            type="hidden"
            name="purchasingAreaId"
            value="${purchasingArea.id}"
          />
          <input type="hidden" name="id" value="${safe(v4())}" />
          <button type="submit">Record spending</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Record spending'), {
      href: purchasingAreaPath(purchasingArea.id),
      label: purchasingArea.name,
    })
  );

export const recordSpendForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel}) =>
      TE.fromEither(purchasingAreaFromParams(readModel, input)),
  formIsAuthorized: isAdminOrSuperUser,
};
