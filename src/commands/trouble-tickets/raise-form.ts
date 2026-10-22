import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {UUID} from 'io-ts-types';
import {
  html,
  Html,
  joinHtml,
  safe,
  sanitizeString,
  SanitizedString,
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {MACHINE_STATUSES, NOT_LISTED} from './raise';

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

type ViewModel = {
  areas: ReadonlyArray<{id: string; name: string}>;
  // Areas' own groupings, in the order each area added them.
  categories: ReadonlyArray<AreaCategory>;
  equipment: ReadonlyArray<MachineOption>;
  // Preselected by a QR code or a link from an equipment page.
  selectedEquipmentId: O.Option<string>;
  // A QR code on an area's noticeboard names the area rather than one
  // machine, so the area is chosen and its equipment listed ready to pick.
  selectedAreaId: O.Option<string>;
};

// The one word the form and the command agree on for "not listed".
const OTHER = NOT_LISTED;

// JSON for the page's script. Escaping '<' keeps a name containing "</script"
// from ending the block early.
const asJson = (value: unknown) =>
  safe(JSON.stringify(value).replace(/</g, '\\u003c'));

const isSelected = (viewModel: ViewModel, id: string) =>
  O.getOrElse(() => '')(viewModel.selectedEquipmentId) === id;

// The area the picker starts on: the deep-linked machine's, else the
// deep-linked area.
const initialAreaId = (viewModel: ViewModel) =>
  pipe(
    viewModel.selectedEquipmentId,
    O.chain(id =>
      O.fromNullable(viewModel.equipment.find(item => item.id === id))
    ),
    O.map(item => item.areaId),
    O.alt(() => viewModel.selectedAreaId),
    O.getOrElse(() => '')
  );

// Each machine is a radio styled as a tile, so the choice posts without any
// script and the browser's own required-check covers it.
const equipmentTile = (viewModel: ViewModel) => (item: MachineOption) => html`
  <label class="tt-tile">
    <input
      type="radio"
      class="visually-hidden"
      name="equipmentId"
      value="${safe(item.id)}"
      ${isSelected(viewModel, item.id) ? safe('checked') : safe('')}
    />
    <span class="tt-tile__name">${sanitizeString(item.name)}</span>
  </label>
`;

const equipmentGrid = (
  viewModel: ViewModel,
  items: ReadonlyArray<MachineOption>
) =>
  html`<div class="tt-grid">
    ${joinHtml(items.map(equipmentTile(viewModel)))}
  </div>`;

// A collapsed section per category, so a big area opens onto a handful of
// headings rather than every machine at once.
const equipmentGroup = (
  viewModel: ViewModel,
  name: Html | SanitizedString,
  items: ReadonlyArray<MachineOption>
) => html`
  <details class="tt-group" data-tt-group>
    <summary>
      <span class="tt-group__name">${name}</span>
      <span class="tt-group__count">${safe(items.length.toString())}</span>
    </summary>
    ${equipmentGrid(viewModel, items)}
  </details>
`;

// An area's equipment: straight into the grid when the area has no
// categories; otherwise one section per category (empty ones skipped) and
// whatever is not in one yet under "Other".
const areaEquipment = (
  viewModel: ViewModel,
  areaId: string,
  items: ReadonlyArray<MachineOption>
) => {
  const categories = viewModel.categories.filter(
    category => category.areaId === areaId
  );
  if (categories.length === 0) {
    return equipmentGrid(viewModel, items);
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
          : [
              equipmentGroup(
                viewModel,
                sanitizeString(category.name),
                inCategory
              ),
            ];
      })
    )}
    ${other.length === 0
      ? html``
      : equipmentGroup(viewModel, html`Other`, other)}
  </div>`;
};

const areasWithEquipment = (viewModel: ViewModel) =>
  viewModel.areas.flatMap(area => {
    const items = viewModel.equipment.filter(item => item.areaId === area.id);
    return items.length === 0 ? [] : [{...area, items}];
  });

// Two steps, each folded to a single line until it is wanted: a grid of
// areas, then the chosen area's equipment.
const equipmentPicker = (viewModel: ViewModel) => {
  const areas = areasWithEquipment(viewModel);
  return html`
    <div
      class="tt-picker"
      id="tt-picker"
      data-initial-area="${safe(initialAreaId(viewModel))}"
    >
      <details class="tt-picker__step" id="tt-area-step">
        <summary>
          <span class="tt-picker__label">Area</span>
          <span class="tt-picker__chosen" id="tt-area-chosen"
            >Choose an area</span
          >
        </summary>
        <div class="tt-grid">
          ${joinHtml(
            areas.map(
              area => html`
                <button
                  type="button"
                  class="tt-tile"
                  data-tt-area="${safe(area.id)}"
                  aria-pressed="false"
                >
                  <span class="tt-tile__name"
                    >${sanitizeString(area.name)}</span
                  >
                  <small class="tt-tile__meta"
                    >${safe(area.items.length.toString())}
                    ${area.items.length === 1
                      ? safe('item')
                      : safe('items')}</small
                  >
                </button>
              `
            )
          )}
        </div>
      </details>

      ${joinHtml(
        areas.map(
          area => html`
            <details
              class="tt-picker__step"
              data-tt-area-panel="${safe(area.id)}"
              data-tt-area-name="${sanitizeString(area.name)}"
            >
              <summary>
                <span class="tt-picker__label"
                  >${sanitizeString(area.name)} equipment</span
                >
                <span class="tt-picker__chosen" data-tt-chosen
                  >Choose equipment</span
                >
              </summary>
              ${areaEquipment(viewModel, area.id, area.items)}
            </details>
          `
        )
      )}

      <label class="tt-tile tt-tile--other">
        <input
          type="radio"
          class="visually-hidden"
          name="equipmentId"
          value="${safe(OTHER)}"
          required
        />
        <span class="tt-tile__name">Other / not listed here</span>
      </label>
    </div>
  `;
};

const searchOptions = (viewModel: ViewModel) =>
  joinHtml(
    viewModel.equipment.map(
      item =>
        html`<option
          value="${sanitizeString(`${item.name} — ${item.areaName}`)}"
        ></option>`
    )
  );

const statusCheckboxes = () =>
  joinHtml(
    MACHINE_STATUSES.map(
      status => html`
        <label class="checkbox-row">
          <input type="checkbox" name="machineStatuses" value="${safe(status)}" />
          <span>${safe(status)}</span>
        </label>
      `
    )
  );

const question = (
  name: string,
  label: string,
  hint: Html,
  required: boolean
) => html`
  <div class="stack tt-form__question">
    <label class="stack">
      <strong>${safe(label)}</strong>
      <small class="tt-form__hint">${hint}</small>
      <textarea
        name="${safe(name)}"
        rows="4"
        ${required ? safe('required') : safe('')}
      ></textarea>
    </label>
  </div>
`;

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack tt-form">
        <h1>Report a problem with a machine</h1>
        <p>
          Owners of the equipment get your report and will pick it up from
          here. You'll get an email confirming it.
        </p>

        <form action="/trouble-tickets/raise" method="post" class="stack">
          <div class="stack tt-form__question">
            <strong>What equipment were you using?</strong>
            <label class="stack tt-search">
              <span class="tt-search__label">Search for your machine</span>
              <span class="tt-search__field">
                <span class="tt-search__icon" aria-hidden="true">&#128269;</span>
                <input
                  type="search"
                  id="tt-equipment-search"
                  list="tt-equipment-list"
                  autocomplete="off"
                  placeholder="Search by machine or area name, e.g. Bandsaw"
                />
              </span>
            </label>

            <p class="tt-form__or">or pick it by area</p>
            <datalist id="tt-equipment-list">
              ${searchOptions(viewModel)}
            </datalist>

            ${equipmentPicker(viewModel)}

            <label class="stack" id="tt-machine-wrapper" hidden>
              <strong>Which one?</strong>
              <select name="machine" id="tt-machine">
                <option value="">Choose…</option>
              </select>
            </label>

            <label class="stack" id="tt-other-wrapper" hidden>
              <strong>Which machine was it?</strong>
              <small class="tt-form__hint"
                >Name it as precisely as you can.</small
              >
              <input
                type="text"
                name="otherEquipmentDetail"
                id="tt-other"
                autocomplete="off"
              />
            </label>
          </div>

          <div class="stack tt-form__question">
            <strong>What's the status of the machine?</strong>
            ${statusCheckboxes()}
          </div>

          ${question(
            'attempting',
            'What were you attempting to do with the machine?',
            html`Please include details about material or file type and what
            you expected to happen.`,
            false
          )}
          ${question(
            'issue',
            'What error or issue did you encounter?',
            html`Please include events and observations about what actually
            happened — the specific error or description of the problem, not
            just "it stopped" or "didn't work".`,
            true
          )}
          ${question(
            'steps',
            'What steps did you take before encountering the error?',
            html`Please include any relevant settings or changes made prior to
            the error — details that will help diagnose the problem, not just
            "tried to print" or "pressed the button".`,
            false
          )}

          <p>
            If you have any additional information to provide in the form of
            files or pictures, please email them to
            <a href="mailto:owners@makespace.org">owners@makespace.org</a>.
          </p>

          <p class="tt-form__closing">
            Thanks for letting us know about the issue. One of the owners of
            the equipment will address this soon! If the equipment is not
            useable, or is unsafe, please put a sign on the equipment telling
            other members and consider a post on the Google group.
          </p>

          <button type="submit">Report the problem</button>
        </form>
      </div>

      <script>
        (function () {
          var equipment = ${asJson(viewModel.equipment)};
          var root = document.getElementById('tt-picker');
          var search = document.getElementById('tt-equipment-search');
          var areaStep = document.getElementById('tt-area-step');
          var areaChosen = document.getElementById('tt-area-chosen');
          var otherWrapper = document.getElementById('tt-other-wrapper');
          var other = document.getElementById('tt-other');
          var machineWrapper = document.getElementById('tt-machine-wrapper');
          var machine = document.getElementById('tt-machine');
          if (!root) return;

          function all(selector) {
            return Array.prototype.slice.call(root.querySelectorAll(selector));
          }
          var areaTiles = all('[data-tt-area]');
          var panels = all('[data-tt-area-panel]');
          var radios = all('input[name="equipmentId"]');

          var byId = {};
          equipment.forEach(function (item) {
            byId[item.id] = item;
          });

          var currentArea = root.getAttribute('data-initial-area') || '';

          function checkedRadio() {
            return radios.filter(function (radio) {
              return radio.checked;
            })[0];
          }

          function panelFor(areaId) {
            return panels.filter(function (panel) {
              return panel.getAttribute('data-tt-area-panel') === areaId;
            })[0];
          }

          // Show only the chosen area's equipment. Without this script every
          // area's equipment is there, each folded under its own name.
          function showArea(areaId) {
            currentArea = areaId;
            var panel = panelFor(areaId);
            panels.forEach(function (candidate) {
              candidate.hidden = candidate !== panel;
            });
            areaTiles.forEach(function (tile) {
              tile.setAttribute(
                'aria-pressed',
                tile.getAttribute('data-tt-area') === areaId ? 'true' : 'false'
              );
            });
            areaChosen.textContent = panel
              ? panel.getAttribute('data-tt-area-name')
              : 'Choose an area';
          }

          // Open the category holding the chosen machine, so reopening the
          // area shows it rather than a row of closed headings.
          function revealGroupOf(radio) {
            var group = radio.closest('[data-tt-group]');
            if (group) group.open = true;
          }

          function syncSelection() {
            var radio = checkedRadio();
            var value = radio ? radio.value : '';
            var item = byId[value];
            var isOther = value === '${safe(OTHER)}';
            otherWrapper.hidden = !isOther;
            other.required = isOther;
            if (!isOther) {
              other.value = '';
            }

            panels.forEach(function (panel) {
              var chosen = panel.querySelector('[data-tt-chosen]');
              chosen.textContent =
                item && item.areaId === panel.getAttribute('data-tt-area-panel')
                  ? item.name
                  : 'Choose equipment';
            });

            var names = item && item.machineNames ? item.machineNames : [];
            machineWrapper.hidden = names.length === 0;
            machine.innerHTML = '';
            if (names.length > 0) {
              var blank = document.createElement('option');
              blank.value = '';
              blank.textContent = 'Choose…';
              machine.appendChild(blank);
              names.forEach(function (name) {
                var option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                machine.appendChild(option);
              });
              var notSure = document.createElement('option');
              notSure.value = "I'm not sure";
              notSure.textContent = "I'm not sure";
              machine.appendChild(notSure);
            }
          }

          // Picking an area folds the area grid away and opens its equipment.
          // A machine already chosen in another area is let go, so the form
          // never posts one that is out of sight.
          areaTiles.forEach(function (tile) {
            tile.addEventListener('click', function () {
              var areaId = tile.getAttribute('data-tt-area');
              var radio = checkedRadio();
              var item = radio && byId[radio.value];
              if (item && item.areaId !== areaId) {
                radio.checked = false;
              }
              showArea(areaId);
              areaStep.open = false;
              var panel = panelFor(areaId);
              if (panel) panel.open = true;
              syncSelection();
            });
          });

          // Picking a machine folds its area away too, leaving its name on the
          // summary line, so the questions below come straight into view.
          radios.forEach(function (radio) {
            radio.addEventListener('change', function () {
              var item = byId[radio.value];
              var panel = item && panelFor(item.areaId);
              if (panel) panel.open = false;
              syncSelection();
            });
          });

          // The search box matches on machine name or area name; picking a
          // suggestion selects it in the grid.
          search.addEventListener('input', function () {
            var typed = search.value.trim().toLowerCase();
            var match = equipment.filter(function (item) {
              return (
                (item.name + ' — ' + item.areaName).toLowerCase() === typed
              );
            })[0];
            var radio =
              match &&
              radios.filter(function (candidate) {
                return candidate.value === match.id;
              })[0];
            if (radio) {
              radio.checked = true;
              showArea(match.areaId);
              revealGroupOf(radio);
              syncSelection();
            }
          });

          // Work the picker's state out from whichever radio is checked: a
          // deep-linked ?equipmentId=, or one the browser put back.
          function restore() {
            var radio = checkedRadio();
            var item = radio && byId[radio.value];
            if (item) {
              showArea(item.areaId);
              revealGroupOf(radio);
            } else {
              showArea(currentArea);
            }
            syncSelection();
          }

          restore();
          // A ?areaId= link from a noticeboard QR code lands on that area's
          // equipment, ready to pick.
          if (currentArea && !checkedRadio()) {
            var landing = panelFor(currentArea);
            if (landing) landing.open = true;
          }

          // A browser restoring the form after a back-navigation puts the
          // values back after this has run, and without firing change - so
          // a restored "Other" sat with its "which machine?" field still
          // hidden and, worse, still required. Look again once the page has
          // fully loaded, and whenever it comes back from the cache.
          window.addEventListener('load', restore);
          window.addEventListener('pageshow', restore);
        })();
      </script>
    `,
    toLoggedInContent(safe('Report a problem'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) => {
    const selected = pipe(
      input,
      t.partial({equipmentId: UUID}).decode,
      E.map(({equipmentId}) => O.fromNullable(equipmentId)),
      E.getOrElse<unknown, O.Option<string>>(() => O.none)
    );
    const selectedArea = pipe(
      input,
      t.partial({areaId: UUID}).decode,
      E.map(({areaId}) => O.fromNullable(areaId)),
      E.getOrElse<unknown, O.Option<string>>(() => O.none)
    );
    const areas = readModel.area
      .getAllMinimal()
      .map(area => ({id: area.id as string, name: area.name}))
      .sort((a, b) => a.name.localeCompare(b.name));
    const areaNames = new Map(areas.map(area => [area.id, area.name]));
    const equipment = readModel.equipment
      .getAllMinimal()
      // Retired equipment cannot be reported on.
      .filter(item => O.isNone(item.removedAt))
      .map(item => ({
        id: item.id as string,
        name: item.name,
        areaId: item.areaId as string,
        areaName: areaNames.get(item.areaId as string) ?? '',
        machineNames: item.machineNames,
        categoryId: O.getOrElse<string | null>(() => null)(
          item.areaCategoryId
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const categories = readModel.area
      .getAllEquipmentCategories()
      .map(category => ({
        id: category.id as string,
        areaId: category.areaId as string,
        name: category.name,
      }));
    return TE.right({
      areas,
      categories,
      equipment,
      selectedEquipmentId: selected,
      selectedAreaId: selectedArea,
    });
  };

export const raiseForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
