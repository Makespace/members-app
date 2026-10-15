import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Form} from '../../types/form';
import {
  html,
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

const renderForm = (purchasingArea: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Rename ${sanitizeString(purchasingArea.name)}</h1>
        <form
          action="${safe(actionReturningTo('rename', purchasingArea.id))}"
          method="post"
        >
          <label for="name">New name</label>
          <input
            type="text"
            name="name"
            id="name"
            value="${sanitizeString(purchasingArea.name)}"
            required
          />
          <input
            type="hidden"
            name="purchasingAreaId"
            value="${purchasingArea.id}"
          />
          <button type="submit">Rename</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Rename purchasing area'), {
      href: purchasingAreaPath(purchasingArea.id),
      label: purchasingArea.name,
    })
  );

export const renameForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel}) =>
      TE.fromEither(purchasingAreaFromParams(readModel, input)),
  formIsAuthorized: isAdminOrSuperUser,
};
