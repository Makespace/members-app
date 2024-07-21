import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';
import * as RA from 'fp-ts/ReadonlyArray';
import {UUID} from 'io-ts-types';
import {pageTemplate} from '../../templates';

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

const addEquipmentCallToAction = (areaId: UUID) => html`
  <a href="/equipment/add?area=${areaId}">Add piece of red equipment</a>
`;

const addOwnerCallToAction = (areaId: UUID) => html`
  <a href="/areas/add-owner?area=${areaId}">Add owner</a>
`;

const renderEquipment = (allEquipment: ViewModel['equipment']) =>
  pipe(
    allEquipment,
    RA.map(
      equipment => html`
        <li>
          <a href="/equipment/${equipment.id}"
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
  pipe(
    html`<h1>${sanitizeString(viewModel.area.name)}</h1>
      ${viewModel.isSuperUser
        ? addEquipmentCallToAction(viewModel.area.id)
        : ''}
      <h2>Owners</h2>
      ${viewModel.isSuperUser ? addOwnerCallToAction(viewModel.area.id) : ''}
      ${renderOwners(viewModel.area.owners)}
      <h2>Equipment</h2>
      ${renderEquipment(viewModel.equipment)} `,
    pageTemplate(sanitizeString(viewModel.area.name), viewModel.user)
  );
