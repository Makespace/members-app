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
        <h1>
          Set the small purchase amount for
          ${sanitizeString(purchasingArea.name)}
        </h1>
        <p>
          A single purchase from the budget costing this much or more needs a
          proposal. It's
          ${sanitizeString(formatPence(purchasingArea.smallPurchaseAmountPence))}
          now. A change applies to requests made from now on; ones already
          made keep the outcome they were given.
        </p>
        <form
          action="${safe(
            actionReturningTo('set-small-purchase-amount', purchasingArea.id)
          )}"
          method="post"
        >
          <label for="smallPurchaseAmount">Small purchase amount (£)</label>
          <input
            type="text"
            inputmode="decimal"
            name="smallPurchaseAmount"
            id="smallPurchaseAmount"
            value="${safe(
              (purchasingArea.smallPurchaseAmountPence / 100).toFixed(2)
            )}"
            required
          />
          <input
            type="hidden"
            name="purchasingAreaId"
            value="${purchasingArea.id}"
          />
          <button type="submit">Set small purchase amount</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Set small purchase amount'), {
      href: purchasingAreaPath(purchasingArea.id),
      label: purchasingArea.name,
    })
  );

export const setSmallPurchaseAmountForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel}) =>
      TE.fromEither(purchasingAreaFromParams(readModel, input)),
  formIsAuthorized: isAdminOrSuperUser,
};
