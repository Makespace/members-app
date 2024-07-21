import {pipe} from 'fp-ts/lib/function';
import {html, safe, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';
import {pageTemplate} from '../../templates';
import {renderMemberNumber} from '../../templates/member-number';

const renderMemberDetails = (user: ViewModel['user']) => html`
  <dl>
    <dt>Email</dt>
    <dd>${sanitizeString(user.emailAddress)}</dd>
    <dt>Member Number</dt>
    <dd>${renderMemberNumber(user.memberNumber)}</dd>
  </dl>
`;

const superUserNav = html`
  <h2>Admin</h2>
  <p>You have super-user privileges. You can:</p>
  <nav>
    <ul>
      <li>
        <a href="/members/create">Link a member number to an e-mail address</a>
      </li>
      <li>
        <a href="/members/failed-imports"
          >See member number imports that need fixing</a
        >
      </li>
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
    pageTemplate(safe('Makespace Member Dashboard'), viewModel.user)
  );
