import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';
import {pageTemplate} from '../../templates';
import {renderMemberNumber} from '../../templates/member-number';

const renderOwnerTable = (owners: ViewModel['areas'][number]['owners']) =>
  pipe(
    owners,
    RA.map(
      owner => html`
        <tr>
          <td>${renderMemberNumber(owner.memberNumber)}</td>
        </tr>
      `
    ),
    RA.match(
      () => html` <p>No owners!</p> `,
      rows => html`
        <table>
          <thead>
            <tr>
              <th>MemberNumber</th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(rows)}
          </tbody>
        </table>
      `
    )
  );

const renderArea = (area: ViewModel['areas'][number]) => html`
  <a href="/areas/${safe(area.id)}"><h2>${sanitizeString(area.name)}</h2></a>
  ${renderOwnerTable(area.owners)}
`;

const renderAreas = (areas: ViewModel['areas']) => {
  if (areas.length === 0) {
    return html`<p>Currently no Areas</p> `;
  }
  return pipe(areas, RA.map(renderArea), joinHtml);
};

const addAreaCallToAction = html`
  <a href="/areas/create">Add area of responsibility</a>
`;

export const render = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Areas of Makespace</h1>
      ${addAreaCallToAction} ${renderAreas(viewModel.areas)}
    `,
    pageTemplate(safe('Areas'), viewModel.user)
  );
