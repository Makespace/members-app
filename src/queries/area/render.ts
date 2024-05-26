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

export const render = (viewModel: ViewModel) =>
  pipe(
    html`<h1>${viewModel.area.name}</h1>
      <p>${viewModel.area.description}</p>
      <p>Owners</p>
      ${renderOwners(viewModel.area.owners)}
      ${viewModel.isSuperUser
        ? addEquipmentCallToAction(viewModel.area.id)
        : ''} `,
    pageTemplate(viewModel.area.name, O.some(viewModel.user))
  );
