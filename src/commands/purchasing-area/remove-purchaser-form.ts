import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Form} from '../../types/form';
import {
  html,
  safe,
  sanitizeString,
  toLoggedInContentWithBackLink,
} from '../../types/html';
import {failureWithStatus} from '../../types/failure-with-status';
import {
  allMemberNumbers,
  PurchasingArea,
  PurchasingAreaPurchaser,
} from '../../read-models/shared-state/return-types';
import {renderMemberNumber} from '../../templates/member-number';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {
  actionReturningTo,
  invalidParameters,
  purchasingAreaFromParams,
  purchasingAreaPath,
} from './helpers';

type ViewModel = {
  purchasingArea: PurchasingArea;
  purchaser: PurchasingAreaPurchaser;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Remove purchaser?</h1>
        <p>
          ${pipe(
            viewModel.purchaser.name,
            O.map(sanitizeString),
            O.getOrElseW(() =>
              sanitizeString(viewModel.purchaser.primaryEmailAddress)
            )
          )}
          ${renderMemberNumber(viewModel.purchaser.memberNumber)} will no
          longer be able to submit purchase requests for
          <b>${sanitizeString(viewModel.purchasingArea.name)}</b>. Requests
          they have already submitted are kept.
        </p>
        <form
          action="${safe(
            actionReturningTo('remove-purchaser', viewModel.purchasingArea.id)
          )}"
          method="post"
        >
          <input
            type="hidden"
            name="purchasingAreaId"
            value="${viewModel.purchasingArea.id}"
          />
          <input
            type="hidden"
            name="memberNumber"
            value="${viewModel.purchaser.memberNumber}"
          />
          <button type="submit">Confirm and remove</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Remove purchaser'), {
      href: purchasingAreaPath(viewModel.purchasingArea.id),
      label: viewModel.purchasingArea.name,
    })
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      E.Do,
      E.bind('purchasingArea', () => purchasingAreaFromParams(readModel, input)),
      E.bind('memberNumber', () =>
        pipe(
          input,
          t.type({member: tt.NumberFromString}).decode,
          E.map(params => params.member),
          E.mapLeft(invalidParameters)
        )
      ),
      E.chain(({purchasingArea, memberNumber}) =>
        pipe(
          purchasingArea.purchasers.find(purchaser =>
            allMemberNumbers(purchaser).includes(memberNumber)
          ),
          E.fromNullable(
            failureWithStatus(
              'The requested member is not a purchaser for the requested purchasing area',
              StatusCodes.NOT_FOUND
            )()
          ),
          E.map(purchaser => ({purchasingArea, purchaser}))
        )
      ),
      TE.fromEither
    );

export const removePurchaserForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
