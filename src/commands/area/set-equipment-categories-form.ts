import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {UUID} from 'io-ts-types';
import {v4} from 'uuid';
import {Form} from '../../types/form';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContentWithBackLink,
} from '../../types/html';
import {failureWithStatus} from '../../types/failure-with-status';
import {EquipmentCategory} from '../../types/equipment-category';
import {categoryDot} from '../../templates/equipment-category';
import {liftActorOrUser} from '../../read-models/lift-actor-or-user';
import {canManageAreaEquipment} from '../authentication-helpers/can-manage-area-equipment';
import {getAreaName} from './get-area-name';

const SortCodec = t.keyof({name: null, category: null});
type Sort = t.TypeOf<typeof SortCodec>;

type CategoryRow = {id: UUID; name: string; count: number};

type EquipmentRow = {
  id: UUID;
  name: string;
  category: EquipmentCategory;
  areaCategoryId: O.Option<UUID>;
};

type ViewModel = {
  areaId: UUID;
  areaName: string;
  sort: Sort;
  categories: ReadonlyArray<CategoryRow>;
  equipment: ReadonlyArray<EquipmentRow>;
};

export const equipmentCategoriesPath = (areaId: UUID, sort: Sort = 'name') =>
  `/areas/equipment-categories?area=${areaId}${
    sort === 'category' ? '&sort=category' : ''
  }`;

// Posting with ?next= brings the browser back to this page once saved.
const returningHere = (action: string, viewModel: ViewModel) =>
  `${action}?next=${encodeURIComponent(
    equipmentCategoriesPath(viewModel.areaId, viewModel.sort)
  )}`;

const byName = (a: {name: string}, b: {name: string}) =>
  a.name.localeCompare(b.name);

// By category: the uncategorised first (they are what still needs doing),
// then each category in the order the area added them.
const sortEquipment = (viewModel: ViewModel): ReadonlyArray<EquipmentRow> => {
  const byNameOnly = [...viewModel.equipment].sort(byName);
  if (viewModel.sort === 'name') {
    return byNameOnly;
  }
  const position = new Map(
    viewModel.categories.map((category, index) => [category.id, index + 1])
  );
  const rank = (item: EquipmentRow) =>
    pipe(
      item.areaCategoryId,
      O.flatMap(id => O.fromNullable(position.get(id))),
      O.getOrElse(() => 0)
    );
  return byNameOnly.sort((a, b) => rank(a) - rank(b));
};

const renderCategoryList = (viewModel: ViewModel) =>
  viewModel.categories.length === 0
    ? html`<p>This area has no categories yet.</p>`
    : html`
        <ul class="area-categories__list">
          ${joinHtml(
            viewModel.categories.map(
              category => html`
                <li>
                  <span
                    >${sanitizeString(category.name)}
                    <small
                      >(${safe(category.count.toString())})</small
                    ></span
                  >
                  <a
                    href="/areas/remove-equipment-category?area=${safe(
                      viewModel.areaId
                    )}&category=${safe(category.id)}"
                    >Remove</a
                  >
                </li>
              `
            )
          )}
        </ul>
      `;

const renderAddCategory = (viewModel: ViewModel) => html`
  <form
    action="${safe(
      returningHere('/areas/add-equipment-category', viewModel)
    )}"
    method="post"
    class="area-categories__add"
  >
    <label for="new-category-name">New category</label>
    <input type="text" id="new-category-name" name="name" required />
    <input type="hidden" name="areaId" value="${safe(viewModel.areaId)}" />
    <input type="hidden" name="categoryId" value="${safe(v4())}" />
    <button type="submit">Add category</button>
  </form>
`;

const radioCell = (
  item: EquipmentRow,
  value: string,
  label: string,
  checked: boolean
) => html`
  <td class="area-categories__choice">
    <label>
      <input
        type="radio"
        name="assignments[${safe(item.id)}]"
        value="${safe(value)}"
        aria-label="${sanitizeString(`${item.name}: ${label}`)}"
        ${checked ? safe('checked') : safe('')}
      />
    </label>
  </td>
`;

const renderSortLinks = (viewModel: ViewModel) => {
  const option = (sort: Sort, label: string) =>
    viewModel.sort === sort
      ? html`<strong>${safe(label)}</strong>`
      : html`<a href="${safe(equipmentCategoriesPath(viewModel.areaId, sort))}"
          >${safe(label)}</a
        >`;
  return html`<p>
    Sort: ${option('name', 'by name')} · ${option('category', 'by category')}
  </p>`;
};

const renderTable = (viewModel: ViewModel) => {
  if (viewModel.categories.length === 0) {
    return html``;
  }
  if (viewModel.equipment.length === 0) {
    return html`<p>This area has no equipment to sort yet.</p>`;
  }
  const uncategorised = viewModel.equipment.filter(item =>
    O.isNone(item.areaCategoryId)
  ).length;
  return html`
    <section class="stack">
      <h2>Sort equipment into categories</h2>
      ${renderSortLinks(viewModel)}
      <p>
        ${safe(uncategorised.toString())} of
        ${safe(viewModel.equipment.length.toString())} not in a category yet.
      </p>
      <form
        action="${safe(
          returningHere('/areas/equipment-categories', viewModel)
        )}"
        method="post"
        class="stack"
      >
        <input type="hidden" name="areaId" value="${safe(viewModel.areaId)}" />
        <div class="area-categories__table-wrap">
          <table class="area-categories__table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th class="area-categories__choice">None</th>
                ${joinHtml(
                  viewModel.categories.map(
                    category =>
                      html`<th class="area-categories__choice">
                        ${sanitizeString(category.name)}
                      </th>`
                  )
                )}
              </tr>
            </thead>
            <tbody>
              ${joinHtml(
                sortEquipment(viewModel).map(
                  item => html`
                    <tr>
                      <td>
                        ${categoryDot(item.category)}${sanitizeString(
                          item.name
                        )}
                      </td>
                      ${radioCell(
                        item,
                        '',
                        'none',
                        O.isNone(item.areaCategoryId)
                      )}
                      ${joinHtml(
                        viewModel.categories.map(category =>
                          radioCell(
                            item,
                            category.id,
                            category.name,
                            O.elem({equals: (a, b) => a === b})(
                              category.id,
                              item.areaCategoryId
                            )
                          )
                        )
                      )}
                    </tr>
                  `
                )
              )}
            </tbody>
          </table>
        </div>
        <div class="area-categories__save">
          <button type="submit" class="button">Save categories</button>
        </div>
      </form>
    </section>
  `;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Equipment categories: ${sanitizeString(viewModel.areaName)}</h1>
        <p>
          Categories split this area's equipment into sections on the Areas
          page, each showing how many red, orange and green items it holds. An
          area without categories lists its equipment as one list.
        </p>
        <section class="stack">
          <h2>Categories</h2>
          ${renderCategoryList(viewModel)} ${renderAddCategory(viewModel)}
        </section>
        ${renderTable(viewModel)}
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Equipment categories'), {
      href: `/areas/manage?area=${viewModel.areaId}`,
      label: 'Manage area',
    })
  );

const paramsCodec = t.intersection([
  t.strict({area: tt.UUID}),
  t.partial({sort: SortCodec}),
]);

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel, user}) =>
    pipe(
      input,
      paramsCodec.decode,
      E.mapLeft(formatValidationErrors),
      E.mapLeft(
        failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)
      ),
      E.filterOrElse(
        ({area}) =>
          canManageAreaEquipment({
            actor: liftActorOrUser(user),
            rm: readModel,
            input: {areaId: area},
          }),
        () =>
          failureWithStatus(
            'Only owners of this area (or admins) can change its categories',
            StatusCodes.FORBIDDEN
          )()
      ),
      E.chain(({area, sort}) =>
        pipe(
          getAreaName(readModel.db, area),
          E.map((areaName): ViewModel => {
            // Obsolete equipment is hidden from the areas page, so there is
            // nothing to sort it for.
            const equipment = readModel.equipment
              .getForAreaMinimal(area)
              .filter(item => O.isNone(item.removedAt));
            return {
              areaId: area,
              areaName,
              sort: sort ?? 'name',
              categories: readModel.area
                .getEquipmentCategories(area)
                .map(category => ({
                  id: category.id,
                  name: category.name,
                  count: equipment.filter(item =>
                    O.exists(id => id === category.id)(item.areaCategoryId)
                  ).length,
                })),
              equipment: equipment.map(item => ({
                id: item.id,
                name: item.name,
                category: item.category,
                areaCategoryId: item.areaCategoryId,
              })),
            };
          })
        )
      ),
      TE.fromEither
    );

export const setEquipmentCategoriesForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
