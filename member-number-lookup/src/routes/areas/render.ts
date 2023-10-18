import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';

const renderAreas = (areas: ViewModel['areas']) =>
  pipe(
    areas,
    RA.map(
      area => html`
        <tr>
          <td>${area.name}</td>
          <td>${area.description}</td>
        </tr>
      `
    ),
    RA.match(
      () => html` <p>Currently no Areas</p> `,
      rows => html`
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
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
  <a href="/command/add-area-of-responsibility">Add area of responsibility</a>
`;

export const render = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Areas of Makespace</h1>
      ${viewModel.isSuperUser ? addAreaCallToAction : ''}
      ${renderAreas(viewModel.areas)}
    `,
    pageTemplate('Areas', O.some(viewModel.user))
  );
