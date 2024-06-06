import {pipe} from 'fp-ts/lib/function';
import {html} from '../../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';

const renderSuperUsers = (superUsers: ViewModel['superUsers']) =>
  pipe(
    superUsers,
    RA.map(
      user => html`
        <tr>
          <td>${user.memberNumber}</td>
          <td>${user.since.toISOString()}</td>
          <td>
            <a href="/super-users/revoke?memberNumber=${user.memberNumber}">
              Revoke
            </a>
          </td>
        </tr>
      `
    ),
    RA.match(
      () => html` <p>Currently no super-users</p> `,
      rows => html`
        <table>
          <tr>
            <th>Member Number</th>
            <th>SU since</th>
            <th></th>
          </tr>
          ${rows.join('\n')}
        </table>
      `
    )
  );

export const render = (viewModel: ViewModel) =>
  html`
      <h1>Super-users</h1>
      <a href="/super-users/declare">Declare a member to be a super-user</a>
      </table>
      ${renderSuperUsers(viewModel.superUsers)}
    `;
