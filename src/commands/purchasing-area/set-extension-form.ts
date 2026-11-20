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

const renderForm = (purchasingArea: ViewModel) => {
  const thisYear = purchasingArea.budgetYear;
  const nextYear = thisYear + 1;
  return pipe(
    html`
      <div class="stack-large">
        <h1>
          Set an extension for ${sanitizeString(purchasingArea.name)}
        </h1>
        <p>
          An extension to the yearly allowance the directors have approved,
          for one year. It's added on top of the usual budget
          (${money(purchasingArea.usualBudgetPence)} now), so it still holds if
          the purchasing area's Areas change. Set it to 0 to remove it.
        </p>
        <ul>
          <li>${thisYear}: ${money(purchasingArea.extensionPence)}</li>
          <li>${nextYear}: ${money(purchasingArea.nextYearExtensionPence)}</li>
        </ul>
        <form
          action="${safe(actionReturningTo('set-extension', purchasingArea.id))}"
          method="post"
        >
          <label for="budgetYear">For</label>
          <select name="budgetYear" id="budgetYear">
            <option value="${thisYear}" selected>${thisYear}</option>
            <option value="${nextYear}">${nextYear}</option>
          </select>
          <label for="extension">Extension (£)</label>
          <input
            type="text"
            inputmode="decimal"
            name="extension"
            id="extension"
            value="${safe((purchasingArea.extensionPence / 100).toFixed(2))}"
            required
          />
          <input
            type="hidden"
            name="purchasingAreaId"
            value="${purchasingArea.id}"
          />
          <button type="submit">Set extension</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Set extension'), {
      href: purchasingAreaPath(purchasingArea.id),
      label: purchasingArea.name,
    })
  );
};

export const setExtensionForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel}) =>
      TE.fromEither(purchasingAreaFromParams(readModel, input)),
  formIsAuthorized: isAdminOrSuperUser,
};
