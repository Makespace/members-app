import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {Form} from '../../types/form';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContentWithBackLink,
} from '../../types/html';
import {PurchasingArea} from '../../read-models/shared-state/return-types';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {
  actionReturningTo,
  purchasingAreaFromParams,
  purchasingAreaPath,
} from './helpers';

type ViewModel = {
  purchasingArea: PurchasingArea;
  // Areas not in any purchasing area yet.
  available: ReadonlyArray<{id: UUID; name: string}>;
  // Areas already in a different purchasing area, for reference.
  elsewhere: ReadonlyArray<{name: string; purchasingAreaName: string}>;
};

const renderAvailable = (viewModel: ViewModel) =>
  viewModel.available.length === 0
    ? html`<p>Every area already belongs to a purchasing area.</p>`
    : html`
        <form
          action="${safe(
            actionReturningTo('assign-area', viewModel.purchasingArea.id)
          )}"
          method="post"
        >
          <label for="areaId">Area</label>
          <select name="areaId" id="areaId" required>
            ${pipe(
              viewModel.available,
              RA.map(
                area =>
                  html`<option value="${area.id}">
                    ${sanitizeString(area.name)}
                  </option>`
              ),
              joinHtml
            )}
          </select>
          <input
            type="hidden"
            name="purchasingAreaId"
            value="${viewModel.purchasingArea.id}"
          />
          <button type="submit">Add area</button>
        </form>
      `;

const renderElsewhere = (viewModel: ViewModel) =>
  viewModel.elsewhere.length === 0
    ? html``
    : html`
        <section class="stack">
          <h2>Already in another purchasing area</h2>
          <p>An area belongs to one purchasing area at a time.</p>
          <ul>
            ${pipe(
              viewModel.elsewhere,
              RA.map(
                area =>
                  html`<li>
                    ${sanitizeString(area.name)} -
                    ${sanitizeString(area.purchasingAreaName)}
                  </li>`
              ),
              joinHtml
            )}
          </ul>
        </section>
      `;

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>
          Add an area to ${sanitizeString(viewModel.purchasingArea.name)}
        </h1>
        ${renderAvailable(viewModel)} ${renderElsewhere(viewModel)}
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Add area to purchasing area'), {
      href: purchasingAreaPath(viewModel.purchasingArea.id),
      label: viewModel.purchasingArea.name,
    })
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      purchasingAreaFromParams(readModel, input),
      E.map(purchasingArea => {
        const assignments = new Map(
          readModel.purchasing
            .getAllAreaAssignments()
            .map(assignment => [assignment.areaId, assignment])
        );
        const areas = [...readModel.area.getAllMinimal()].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        return {
          purchasingArea,
          available: areas
            .filter(area => !assignments.has(area.id))
            .map(area => ({id: area.id, name: area.name})),
          elsewhere: areas.flatMap(area => {
            const assignment = assignments.get(area.id);
            return assignment === undefined ||
              assignment.id === purchasingArea.id
              ? []
              : [{name: area.name, purchasingAreaName: assignment.name}];
          }),
        };
      }),
      TE.fromEither
    );

export const assignAreaForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
