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
          Set the small repairs amount for
          ${sanitizeString(purchasingArea.name)}
        </h1>
        <p>
          Repairs don't come out of the yearly budget, but a single repair
          costing this much or more needs a super user's approval rather than
          a purchaser's. It's
          ${sanitizeString(formatPence(purchasingArea.smallRepairsAmountPence))}
          now. A change applies to requests made from now on; ones already
          made keep the approval they were given.
        </p>
        <form
          action="${safe(
            actionReturningTo('set-small-repairs-amount', purchasingArea.id)
          )}"
          method="post"
        >
          <label for="smallRepairsAmount">Small repairs amount (£)</label>
          <input
            type="text"
            inputmode="decimal"
            name="smallRepairsAmount"
            id="smallRepairsAmount"
            value="${safe(
              (purchasingArea.smallRepairsAmountPence / 100).toFixed(2)
            )}"
            required
          />
          <input
            type="hidden"
            name="purchasingAreaId"
            value="${purchasingArea.id}"
          />
          <button type="submit">Set small repairs amount</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Set small repairs amount'), {
      href: purchasingAreaPath(purchasingArea.id),
      label: purchasingArea.name,
    })
  );

export const setSmallRepairsAmountForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel}) =>
      TE.fromEither(purchasingAreaFromParams(readModel, input)),
  formIsAuthorized: isAdminOrSuperUser,
};
