import * as E from 'fp-ts/Either';
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
import {purchasingAreaFromParams, purchasingAreaPath} from './helpers';

type ViewModel = {
  purchasingArea: PurchasingArea;
  // Purchase requests or recorded spending stop it being removed.
  hasHistory: boolean;
};

const renderForm = ({purchasingArea, hasHistory}: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Remove ${sanitizeString(purchasingArea.name)}?</h1>
        ${hasHistory
          ? html`
              <p>
                It has purchase requests or recorded spending, so it can't be
                removed. To stop new purchase requests,
                <a
                  href="/purchasing-areas/deactivate?purchasingArea=${purchasingArea.id}"
                  >deactivate it</a
                >
                instead.
              </p>
            `
          : html`
              <p>
                This removes the purchasing area for good, along with its
                budgets and its list of purchasers. Its areas are no longer in
                any purchasing area.
              </p>
              <form
                action="/purchasing-areas/remove?next=${safe(
                  encodeURIComponent('/purchasing-areas')
                )}"
                method="post"
              >
                <input
                  type="hidden"
                  name="purchasingAreaId"
                  value="${purchasingArea.id}"
                />
                <button type="submit">Confirm and remove</button>
              </form>
            `}
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Remove purchasing area'), {
      href: purchasingAreaPath(purchasingArea.id),
      label: purchasingArea.name,
    })
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      purchasingAreaFromParams(readModel, input),
      E.map(purchasingArea => ({
        purchasingArea,
        hasHistory: readModel.purchasing.hasHistory(purchasingArea.id),
      })),
      TE.fromEither
    );

export const removeForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
