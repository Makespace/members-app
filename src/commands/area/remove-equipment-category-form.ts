import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {UUID} from 'io-ts-types';
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
  categoryId: UUID;
  categoryName: string;
  equipmentCount: number;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Remove category?</h1>
        <p>
          This removes the <b>${sanitizeString(viewModel.categoryName)}</b>
          category from ${sanitizeString(viewModel.areaName)}.
          ${viewModel.equipmentCount === 0
            ? html`No equipment is in it.`
            : html`The ${safe(viewModel.equipmentCount.toString())}
              ${safe(viewModel.equipmentCount === 1 ? 'item' : 'items')} in it
              will be left without a category; the equipment itself is not
              touched.`}
        </p>
        <form
          action="/areas/remove-equipment-category?next=${safe(
            encodeURIComponent(equipmentCategoriesPath(viewModel.areaId))
          )}"
          method="post"
        >
          <input
            type="hidden"
            name="areaId"
            value="${safe(viewModel.areaId)}"
          />
          <input
            type="hidden"
            name="categoryId"
            value="${safe(viewModel.categoryId)}"
          />
          <button type="submit">Remove category</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Remove equipment category'), {
      href: equipmentCategoriesPath(viewModel.areaId),
      label: 'Equipment categories',
    })
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      input,
      t.strict({area: tt.UUID, category: tt.UUID}).decode,
      E.mapLeft(formatValidationErrors),
      E.mapLeft(
        failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)
      ),
      E.chain(({area, category}) =>
        pipe(
          E.Do,
          E.bind('areaName', () => getAreaName(readModel.db, area)),
          E.bind('found', () =>
            pipe(
              readModel.area
                .getEquipmentCategories(area)
                .find(candidate => candidate.id === category),
              E.fromNullable(
                failureWithStatus(
                  'That category no longer exists',
                  StatusCodes.NOT_FOUND
                )()
              )
            )
          ),
          E.map(({areaName, found}) => ({
            areaId: area,
            areaName,
            categoryId: found.id,
            categoryName: found.name,
            equipmentCount: readModel.equipment
              .getForAreaMinimal(area)
              .filter(
                item =>
                  O.isNone(item.removedAt) &&
                  O.exists(id => id === found.id)(item.areaCategoryId)
              ).length,
          }))
        )
      ),
      TE.fromEither
    );

export const removeEquipmentCategoryForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
