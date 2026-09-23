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
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {MACHINE_STATUSES} from './raise';

type MachineOption = {
  id: string;
  name: string;
  areaId: string;
  areaName: string;
  machineNames: ReadonlyArray<string>;
};

type ViewModel = {
  areas: ReadonlyArray<{id: string; name: string}>;
  equipment: ReadonlyArray<MachineOption>;
  // Preselected by a QR code or a link from an equipment page.
  selectedEquipmentId: O.Option<string>;
  // A QR code on an area's noticeboard names the area rather than one
  // machine, so the area is chosen and its equipment listed ready to pick.
  selectedAreaId: O.Option<string>;
};

const OTHER = 'other';

// JSON for the page's script. Escaping '<' keeps a name containing "</script"
// from ending the block early.
const asJson = (value: unknown) =>
  safe(JSON.stringify(value).replace(/</g, '\\u003c'));

const equipmentOptions = (viewModel: ViewModel) =>
  pipe(
    viewModel.areas,
    areas =>
      areas.map(area => {
        const items = viewModel.equipment.filter(
          item => item.areaId === area.id
        );
        return items.length === 0
          ? html``
          : html`<optgroup label="${sanitizeString(area.name)}">
              ${joinHtml(
                items.map(
                  item =>
                    html`<option
                      value="${safe(item.id)}"
                      ${O.getOrElse(() => '')(
                        viewModel.selectedEquipmentId
                      ) === item.id
                        ? safe('selected')
                        : safe('')}
                    >
                      ${sanitizeString(item.name)}
                    </option>`
                )
              )}
            </optgroup>`;
      }),
    joinHtml
  );

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

            <p class="tt-form__or">or pick it from the lists</p>
            <datalist id="tt-equipment-list">
              ${searchOptions(viewModel)}
            </datalist>

            <label class="stack">
              <small class="tt-form__hint">Area</small>
              <select id="tt-area">
                <option value="">All areas</option>
                ${joinHtml(
                  viewModel.areas.map(
                    area =>
                      html`<option
                        value="${safe(area.id)}"
                        ${O.getOrElse(() => '')(viewModel.selectedAreaId) ===
                        area.id
                          ? safe('selected')
                          : safe('')}
                      >
                        ${sanitizeString(area.name)}
                      </option>`
                  )
                )}
              </select>
            </label>

            <label class="stack">
              <small class="tt-form__hint">Equipment</small>
              <select name="equipmentId" id="tt-equipment" required>
                <option value="">Choose equipment…</option>
                ${equipmentOptions(viewModel)}
                <option value="${safe(OTHER)}">
                  Other / not listed here
                </option>
              </select>
            </label>

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
          var search = document.getElementById('tt-equipment-search');
          var area = document.getElementById('tt-area');
          var picker = document.getElementById('tt-equipment');
          var otherWrapper = document.getElementById('tt-other-wrapper');
          var other = document.getElementById('tt-other');
          var machineWrapper = document.getElementById('tt-machine-wrapper');
          var machine = document.getElementById('tt-machine');
          if (!picker) return;

          var byId = {};
          equipment.forEach(function (item) {
            byId[item.id] = item;
          });

          // Rebuild the equipment list for the chosen area. Hiding <option>
          // elements is not reliable across browsers, so the options are
          // replaced outright.
          function applyAreaFilter() {
            var wanted = area.value;
            var keep = picker.value;
            var shown = equipment.filter(function (item) {
              return !wanted || item.areaId === wanted;
            });
            picker.innerHTML = '';

            var blank = document.createElement('option');
            blank.value = '';
            blank.textContent = 'Choose equipment…';
            picker.appendChild(blank);

            var groups = {};
            shown.forEach(function (item) {
              var group = groups[item.areaId];
              if (!group) {
                group = document.createElement('optgroup');
                group.label = item.areaName;
                groups[item.areaId] = group;
                picker.appendChild(group);
              }
              var option = document.createElement('option');
              option.value = item.id;
              option.textContent = item.name;
              group.appendChild(option);
            });

            var other = document.createElement('option');
            other.value = '${safe(OTHER)}';
            other.textContent = 'Other / not listed here';
            picker.appendChild(other);

            // Keep the current choice when it still belongs to the area.
            var stillThere = Array.prototype.some.call(
              picker.querySelectorAll('option'),
              function (option) {
                return option.value === keep;
              }
            );
            picker.value = stillThere ? keep : '';
          }

          function syncSelection() {
            var value = picker.value;
            var item = byId[value];
            var isOther = value === '${safe(OTHER)}';
            otherWrapper.hidden = !isOther;
            other.required = isOther;
            if (!isOther) {
              other.value = '';
            }

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

          // The search box matches on machine name or area name; picking a
          // suggestion selects it in the dropdown.
          search.addEventListener('input', function () {
            var typed = search.value.trim().toLowerCase();
            var match = equipment.filter(function (item) {
              return (
                (item.name + ' — ' + item.areaName).toLowerCase() === typed
              );
            })[0];
            if (match) {
              area.value = '';
              applyAreaFilter();
              picker.value = match.id;
              syncSelection();
            }
          });

          area.addEventListener('change', function () {
            applyAreaFilter();
            syncSelection();
          });
          picker.addEventListener('change', syncSelection);

          // Preserve a deep-linked ?equipmentId= selection through the first
          // rebuild.
          var preselected = picker.value;
          applyAreaFilter();
          if (preselected) {
            picker.value = preselected;
          }
          syncSelection();
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
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return TE.right({
      areas,
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
