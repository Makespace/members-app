import * as O from 'fp-ts/Option';
import {
  html,
  Html,
  joinHtml,
  safe,
  sanitizeString,
  SanitizedString,
} from '../types/html';
import {SharedReadModel} from '../read-models/shared-state';

// Choosing a machine as tiles grouped by area and then by the area's own
// categories: the trouble-ticket form and the e-ink display form both pick
// one this way. Each machine is a radio named equipmentId styled as a tile,
// so the choice posts without any script and the browser's own
// required-check covers it.

type MachineOption = {
  id: string;
  name: string;
  areaId: string;
  areaName: string;
  machineNames: ReadonlyArray<string>;
  // The area's own grouping for it, when it has been sorted into one.
  categoryId: string | null;
};

type AreaCategory = {id: string; areaId: string; name: string};

export type EquipmentPickerModel = {
  areas: ReadonlyArray<{id: string; name: string}>;
  // Areas' own groupings, in the order each area added them.
  categories: ReadonlyArray<AreaCategory>;
  equipment: ReadonlyArray<MachineOption>;
  selectedEquipmentId: O.Option<string>;
};

// Every area and its equipment still in use, sorted by name.
export const equipmentPickerChoices = (
  readModel: SharedReadModel
): Omit<EquipmentPickerModel, 'selectedEquipmentId'> => {
  const areas = readModel.area
    .getAllMinimal()
    .map(area => ({id: area.id as string, name: area.name}))
    .sort((a, b) => a.name.localeCompare(b.name));
  const areaNames = new Map(areas.map(area => [area.id, area.name]));
  const equipment = readModel.equipment
    .getAllMinimal()
    // Retired equipment is not offered.
    .filter(item => O.isNone(item.removedAt))
    .map(item => ({
      id: item.id as string,
      name: item.name,
      areaId: item.areaId as string,
      areaName: areaNames.get(item.areaId as string) ?? '',
      machineNames: item.machineNames,
      categoryId: O.getOrElse<string | null>(() => null)(item.areaCategoryId),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const categories = readModel.area
    .getAllEquipmentCategories()
    .map(category => ({
      id: category.id as string,
      areaId: category.areaId as string,
      name: category.name,
    }));
  return {areas, categories, equipment};
};

const isSelected = (model: EquipmentPickerModel, id: string) =>
  O.getOrElse(() => '')(model.selectedEquipmentId) === id;

const equipmentTile = (model: EquipmentPickerModel) => (item: MachineOption) =>
  html`
    <label class="tt-tile">
      <input
        type="radio"
        class="visually-hidden"
        name="equipmentId"
        value="${safe(item.id)}"
        ${isSelected(model, item.id) ? safe('checked') : safe('')}
      />
      <span class="tt-tile__name">${sanitizeString(item.name)}</span>
    </label>
  `;

const equipmentGrid = (
  model: EquipmentPickerModel,
  items: ReadonlyArray<MachineOption>
) =>
  html`<div class="tt-grid">
    ${joinHtml(items.map(equipmentTile(model)))}
  </div>`;

// A collapsed section per category, so a big area opens onto a handful of
// headings rather than every machine at once.
const equipmentGroup = (
  model: EquipmentPickerModel,
  name: Html | SanitizedString,
  items: ReadonlyArray<MachineOption>
) => html`
  <details
    class="tt-group"
    data-tt-group
    ${items.some(item => isSelected(model, item.id)) ? safe('open') : safe('')}
  >
    <summary>
      <span class="tt-group__name">${name}</span>
      <span class="tt-group__count">${safe(items.length.toString())}</span>
    </summary>
    ${equipmentGrid(model, items)}
  </details>
`;

// An area's equipment: straight into the grid when the area has no
// categories; otherwise one section per category (empty ones skipped) and
// whatever is not in one yet under "Other".
export const areaEquipment = (
  model: EquipmentPickerModel,
  areaId: string,
  items: ReadonlyArray<MachineOption>
) => {
  const categories = model.categories.filter(
    category => category.areaId === areaId
  );
  if (categories.length === 0) {
    return equipmentGrid(model, items);
  }
  const known = new Set(categories.map(category => category.id));
  const other = items.filter(
    item => item.categoryId === null || !known.has(item.categoryId)
  );
  return html`<div class="tt-groups">
    ${joinHtml(
      categories.flatMap(category => {
        const inCategory = items.filter(
          item => item.categoryId === category.id
        );
        return inCategory.length === 0
          ? []
          : [equipmentGroup(model, sanitizeString(category.name), inCategory)];
      })
    )}
    ${other.length === 0 ? html`` : equipmentGroup(model, html`Other`, other)}
  </div>`;
};

export const areasWithEquipment = (model: EquipmentPickerModel) =>
  model.areas.flatMap(area => {
    const items = model.equipment.filter(item => item.areaId === area.id);
    return items.length === 0 ? [] : [{...area, items}];
  });

// The picker with no script behind it: each area folded under its own name,
// the one holding the chosen machine open.
export const staticEquipmentPicker = (model: EquipmentPickerModel) =>
  html`<div class="tt-picker">
    ${joinHtml(
      areasWithEquipment(model).map(
        area => html`
          <details
            class="tt-picker__step"
            ${area.items.some(item => isSelected(model, item.id))
              ? safe('open')
              : safe('')}
          >
            <summary>
              <span class="tt-picker__label"
                >${sanitizeString(area.name)}</span
              >
              <span class="tt-picker__chosen"
                >${safe(area.items.length.toString())}
                ${area.items.length === 1 ? safe('item') : safe('items')}</span
              >
            </summary>
            ${areaEquipment(model, area.id, area.items)}
          </details>
        `
      )
    )}
  </div>`;
