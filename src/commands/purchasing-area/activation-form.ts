import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Form} from '../../types/form';
import {
  html,
  Html,
  safe,
  sanitizeString,
  toLoggedInContentWithBackLink,
} from '../../types/html';
import {PurchasingArea} from '../../read-models/shared-state/return-types';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {
  actionReturningTo,
  purchasingAreaFromParams,
  purchasingAreaPath,
} from './helpers';

type ViewModel = PurchasingArea;

const confirmationForm = (page: {
  verb: string;
  title: string;
  explanation: (purchasingArea: ViewModel) => Html;
  button: string;
}): Form<ViewModel> => ({
  renderForm: purchasingArea =>
    pipe(
      html`
        <div class="stack-large">
          <h1>${safe(page.title)} ${sanitizeString(purchasingArea.name)}?</h1>
          ${page.explanation(purchasingArea)}
          <form
            action="${safe(actionReturningTo(page.verb, purchasingArea.id))}"
            method="post"
          >
            <input
              type="hidden"
              name="purchasingAreaId"
              value="${purchasingArea.id}"
            />
            <button type="submit">${safe(page.button)}</button>
          </form>
        </div>
      `,
      toLoggedInContentWithBackLink(safe(`${page.title} purchasing area`), {
        href: purchasingAreaPath(purchasingArea.id),
        label: purchasingArea.name,
      })
    ),
  constructForm:
    input =>
    ({readModel}) =>
      TE.fromEither(purchasingAreaFromParams(readModel, input)),
  formIsAuthorized: isAdminOrSuperUser,
});

export const activateForm = confirmationForm({
  verb: 'activate',
  title: 'Activate',
  explanation: () => html`
    <p>
      Once it is active, owners of its areas, its purchasers and super users
      can request purchases against its budget, and its budget is live.
    </p>
  `,
  button: 'Activate',
});

export const deactivateForm = confirmationForm({
  verb: 'deactivate',
  title: 'Deactivate',
  explanation: () => html`
    <p>
      Nobody will be able to request a purchase against it until it is
      activated again. Purchase requests already made carry on as normal, and
      can still be approved, declined and marked as bought.
    </p>
  `,
  button: 'Deactivate',
});
