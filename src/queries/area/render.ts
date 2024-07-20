import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';
import * as RA from 'fp-ts/ReadonlyArray';

const renderOwners = (owners: ViewModel['area']['owners']) =>
  pipe(
    owners,
    RA.map(owner => html`<li>${owner}</li>`),
    joinHtml,
    items =>
      html`<ul>
        ${items}
      </ul>`
  );

const addEquipmentCallToAction = (areaId: string) => html`
  <a href="/equipment/add?area=${sanitizeString(areaId)}"
    >Add piece of red equipment</a
  >
`;

const addOwnerCallToAction = (areaId: string) => html`
  <a href="/areas/add-owner?area=${sanitizeString(areaId)}">Add owner</a>
`;

const renderEquipment = (allEquipment: ViewModel['equipment']) =>
  pipe(
    allEquipment,
    RA.map(
      equipment => html`
        <li>
          <a href="/equipment/${sanitizeString(equipment.id)}"
            >${sanitizeString(equipment.name)}</a
          >
        </li>
      `
    ),
    joinHtml,
    items => html`
      <ul>
        ${items}
      </ul>
    `
  );

export const render = (viewModel: ViewModel) =>
  html`<h1>${sanitizeString(viewModel.area.name)}</h1>
    ${viewModel.isSuperUser
      ? addEquipmentCallToAction(viewModel.area.id)
      : html``}
    <h2>Owners</h2>
    ${viewModel.isSuperUser ? addOwnerCallToAction(viewModel.area.id) : html``}
    ${renderOwners(viewModel.area.owners)}
    <h2>Equipment</h2>
    ${renderEquipment(viewModel.equipment)} `;
