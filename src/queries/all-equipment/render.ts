import {pipe} from 'fp-ts/lib/function';
import {html} from '../../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';

const renderEquipment = (allEquipment: ViewModel['equipment']) =>
  pipe(
    allEquipment,
    RA.map(
      equipment => html`
        <tr>
          <td><a href="/equipment/${equipment.id}">${equipment.name}</a></td>
          <td>
            <a href="/areas/${equipment.areaId}">${equipment.areaName}</a>
          </td>
        </tr>
      `
    ),
    RA.match(
      () => html` <p>Currently no Equipment</p> `,
      rows => html`
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Area</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join('\n')}
          </tbody>
        </table>
      `
    )
  );

const addAreaCallToAction = html`
  <a href="/areas/create">Add area of responsibility</a>
`;

export const render = (viewModel: ViewModel) => html`
  <h1>Equipment of Makespace</h1>
  ${viewModel.isSuperUser ? addAreaCallToAction : ''}
  ${renderEquipment(viewModel.equipment)}
`;
