import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {Form} from '../../types/form';
import {
  html,
  safe,
  sanitizeString,
  toLoggedInContentWithBackLink,
} from '../../types/html';
import {failureWithStatus} from '../../types/failure-with-status';
import {PurchasingArea} from '../../read-models/shared-state/return-types';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {
  actionReturningTo,
  invalidParameters,
  purchasingAreaFromParams,
  purchasingAreaPath,
} from './helpers';

type ViewModel = {
  purchasingArea: PurchasingArea;
  area: {id: UUID; name: string};
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Remove area?</h1>
        <p>
          This takes <b>${sanitizeString(viewModel.area.name)}</b> out of the
          purchasing area
          <b>${sanitizeString(viewModel.purchasingArea.name)}</b>. Purchase
          requests already submitted stay where they are.
        </p>
        <form
          action="${safe(
            actionReturningTo('unassign-area', viewModel.purchasingArea.id)
          )}"
          method="post"
        >
          <input
            type="hidden"
            name="purchasingAreaId"
            value="${viewModel.purchasingArea.id}"
          />
          <input type="hidden" name="areaId" value="${viewModel.area.id}" />
          <button type="submit">Confirm and remove</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Remove area from purchasing area'), {
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
      E.bind('areaId', () =>
        pipe(
          input,
          t.type({area: UUID}).decode,
          E.map(params => params.area),
          E.mapLeft(invalidParameters)
        )
      ),
      E.chain(({purchasingArea, areaId}) =>
        pipe(
          purchasingArea.areas.find(area => area.id === areaId),
          E.fromNullable(
            failureWithStatus(
              'The requested area is not part of the requested purchasing area',
              StatusCodes.NOT_FOUND
            )()
          ),
          E.map(area => ({purchasingArea, area}))
        )
      ),
      TE.fromEither
    );

export const unassignAreaForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
