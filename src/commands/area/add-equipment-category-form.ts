import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {UUID} from 'io-ts-types';
import {v4} from 'uuid';
import {Form} from '../../types/form';
import {
  html,
  safe,
  sanitizeString,
  toLoggedInContentWithBackLink,
} from '../../types/html';
import {failureWithStatus} from '../../types/failure-with-status';
import {getAreaName} from './get-area-name';
import {equipmentCategoriesPath} from './set-equipment-categories-form';

type ViewModel = {
  areaId: UUID;
  areaName: string;
};

// The categories page carries its own add box; this standalone page is what
// the route serves on a plain GET, and returns there once added.
const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Add an equipment category to ${sanitizeString(viewModel.areaName)}</h1>
      <form
        action="/areas/add-equipment-category?next=${safe(
          encodeURIComponent(equipmentCategoriesPath(viewModel.areaId))
        )}"
        method="post"
        class="stack"
      >
        <label for="name">Category name</label>
        <input type="text" name="name" id="name" required />
        <input type="hidden" name="areaId" value="${safe(viewModel.areaId)}" />
        <input type="hidden" name="categoryId" value="${safe(v4())}" />
        <button type="submit">Add category</button>
      </form>
    `,
    toLoggedInContentWithBackLink(safe('Add equipment category'), {
      href: equipmentCategoriesPath(viewModel.areaId),
      label: 'Equipment categories',
    })
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      input,
      t.strict({area: tt.UUID}).decode,
      E.mapLeft(formatValidationErrors),
      E.mapLeft(
        failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)
      ),
      E.chain(({area}) =>
        pipe(
          getAreaName(readModel.db, area),
          E.map(areaName => ({areaId: area, areaName}))
        )
      ),
      TE.fromEither
    );

export const addEquipmentCategoryForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
