import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
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
  <a href="/areas/${areaId}/add-equipment">Add piece of red equipment</a>
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
  pipe(
    html`<h1>${viewModel.area.name}</h1>
      <p>${viewModel.area.description}</p>
      ${viewModel.isSuperUser
        ? addEquipmentCallToAction(viewModel.area.id)
        : ''}
      <h2>Owners</h2>
      ${renderOwners(viewModel.area.owners)}
      <h2>Equipment</h2>
      ${renderEquipment(viewModel.equipment)} `,
    pageTemplate(viewModel.area.name, O.some(viewModel.user))
  );
