import {pipe} from 'fp-ts/lib/function';
import {
  commaHtml,
  html,
  joinHtml,
  safe,
  sanitizeString,
} from '../../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';
import {pageTemplate} from '../../templates';
import {renderMemberNumber} from '../../templates/member-number';

const renderAreas = (areas: ViewModel['areas']) =>
  pipe(
    areas,
    RA.map(
      area => html`
        <tr>
          <td>
            <a href="/areas/${area.id}">${sanitizeString(area.name)}</a>
          </td>
          <td>${commaHtml(area.owners.map(renderMemberNumber))}</td>
          <td>
            <a href="/areas/add-owner?area=${area.id}">Add owner</a>
          </td>
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
              <th>Owners</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(rows)}
          </tbody>
        </table>
      `
    )
  );

const addAreaCallToAction = html`
  <a href="/areas/create">Add area of responsibility</a>
`;

export const render = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Areas of Makespace</h1>
      ${viewModel.isSuperUser ? addAreaCallToAction : ''}
      ${renderAreas(viewModel.areas)}
    `,
    pageTemplate(safe('Areas'), viewModel.user)
  );
