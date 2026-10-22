import * as E from 'fp-ts/Either';
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
import {formatPence} from '../../types/money';
import {
  PurchasingArea,
  RecordedSpend,
} from '../../read-models/shared-state/return-types';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {
  actionReturningTo,
  invalidParameters,
  purchasingAreaFromParams,
  purchasingAreaPath,
} from './helpers';

type ViewModel = {
  purchasingArea: PurchasingArea;
  spend: RecordedSpend;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Remove recorded spending?</h1>
        <p>
          <b>${sanitizeString(formatPence(viewModel.spend.amountPence))}</b>
          (${sanitizeString(viewModel.spend.description)}) will no longer
          count against
          <b>${sanitizeString(viewModel.purchasingArea.name)}</b>'s
          ${viewModel.purchasingArea.budgetYear} budget.
        </p>
        <form
          action="${safe(
            actionReturningTo('remove-spend', viewModel.purchasingArea.id)
          )}"
          method="post"
        >
          <input
            type="hidden"
            name="purchasingAreaId"
            value="${viewModel.purchasingArea.id}"
          />
          <input type="hidden" name="id" value="${viewModel.spend.id}" />
          <button type="submit">Confirm and remove</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Remove recorded spending'), {
      href: purchasingAreaPath(viewModel.purchasingArea.id),
      label: viewModel.purchasingArea.name,
    })
  );

// Reached as /purchasing-areas/remove-spend?purchasingArea=<id>&spend=<id>.
const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      E.Do,
      E.bind('purchasingArea', () => purchasingAreaFromParams(readModel, input)),
      E.bind('spendId', () =>
        pipe(
          input,
          t.type({spend: tt.UUID}).decode,
          E.map(params => params.spend),
          E.mapLeft(invalidParameters)
        )
      ),
      E.chain(({purchasingArea, spendId}) =>
        pipe(
          purchasingArea.recordedSpend.find(spend => spend.id === spendId),
          E.fromNullable(
            failureWithStatus(
              "That spending isn't recorded against this year's budget",
              StatusCodes.NOT_FOUND
            )()
          ),
          E.map(spend => ({purchasingArea, spend}))
        )
      ),
      TE.fromEither
    );

export const removeSpendForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
