import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import {ViewModel} from './view-model';

const renderMemberDetails = (user: ViewModel['user']) => html`
  <dl>
    <dt>Email</dt>
    <dd>${user.emailAddress}</dd>
    <dt>Member Number</dt>
    <dd>${user.memberNumber}</dd>
  </dl>
`;

const superUserNav = html`
  <h2>Admin</h2>
  <p>You have super-user privileges. You can:</p>
  <nav>
    <ul>
      <li>
        <a href="/areas/create">Add area of responsibility</a>
      </li>
      <li>
        <a href="/super-users">View all super-users</a>
      </li>
      <li>
        <a href="/event-log">View log of all actions taken</a>
      </li>
    </ul>
  </nav>
`;

export const render = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Makespace Member Dashboard</h1>
      <h2>Your Details</h2>
      ${renderMemberDetails(viewModel.user)}
      ${viewModel.isSuperUser ? superUserNav : ''}

      </table>
    `,
    pageTemplate('Dashboard', O.some(viewModel.user))
  );
