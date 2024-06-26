import {pipe} from 'fp-ts/lib/function';
import {html} from '../../types/html';
import {ViewModel} from './view-model';
import * as RA from 'fp-ts/ReadonlyArray';

const renderOwners = (owners: ViewModel['area']['owners']) =>
  pipe(
    owners,
    RA.map(owner => html`<li>${owner}</li>`),
    items =>
      html`<ul>
        ${items.join('\n')}
      </ul>`
  );

const addEquipmentCallToAction = (areaId: string) => html`
  <a href="/equipment/add?area=${areaId}">Add piece of red equipment</a>
`;

const addOwnerCallToAction = (areaId: string) => html`
  <a href="/areas/add-owner?area=${areaId}">Add owner</a>
`;

const renderEquipment = (allEquipment: ViewModel['equipment']) =>
  pipe(
    allEquipment,
    RA.map(
      equipment => html`
        <li><a href="/equipment/${equipment.id}">${equipment.name}</a></li>
      `
    ),
    items => html`
      <ul>
        ${items.join('\n')}
      </ul>
    `
  );

export const render = (viewModel: ViewModel) =>
  html`<h1>${viewModel.area.name}</h1>
    ${viewModel.isSuperUser ? addEquipmentCallToAction(viewModel.area.id) : ''}
    <h2>Owners</h2>
    ${viewModel.isSuperUser ? addOwnerCallToAction(viewModel.area.id) : ''}
    ${renderOwners(viewModel.area.owners)}
    <h2>Equipment</h2>
    ${renderEquipment(viewModel.equipment)} `;
