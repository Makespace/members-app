import {pipe} from 'fp-ts/lib/function';
import {html} from '../../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';

const renderMembers = (members: ViewModel['members']) =>
  pipe(
    members,
    RA.map(
      member => html`
        <tr>
          <td>${member.email}</td>
          <td>${member.memberNumber}</td>
        </tr>
      `
    ),
    RA.match(
      () => html` <p>Currently no members</p> `,
      rows => html`
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Member number</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join('\n')}
          </tbody>
        </table>
      `
    )
  );

export const render = (viewModel: ViewModel) => html`
  <h1>Members of Makespace</h1>
  ${renderMembers(viewModel.members)}
`;
