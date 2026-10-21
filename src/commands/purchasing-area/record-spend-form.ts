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
          Spending against ${purchasingArea.budgetYear}'s budget that didn't
          come through a purchase request, e.g. what was spent before requests
          were in the app. ${money(purchasingArea.spentThisYearPence)} of
          ${money(purchasingArea.yearlyBudgetPence)} has been spent so far.
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
            placeholder="e.g. Spending before purchase requests were in the app"
            required
          />
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
