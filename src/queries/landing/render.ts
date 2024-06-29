import {ViewModel} from './view-model';
import {pageTemplate} from '../../templates';
import * as O from 'fp-ts/Option';
import {SafeString} from 'handlebars';

Handlebars.registerPartial(
  'landing_page_member_details',
  `
  <dl>
    <dt>Email</dt>
    <dd>{{user.emailAddress}}</dd>
    <dt>Member Number</dt>
    <dd>{{user.memberNumber}}</dd>
  </dl>
`
);

Handlebars.registerPartial(
  'super_user_nav',
  `
  <h2>Admin</h2>
  <p>You have super-user privileges. You can:</p>
  <nav>
    <ul>
      <li>
        <a href="/members/create">Link a member number to an e-mail address</a>
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
`
);

const LANDING_PAGE_TEMPLATE = Handlebars.compile(`
  <h1>Makespace Member Dashboard</h1>
  <h2>Your Details</h2>
  {{> landing_page_member_details}}
  {{#if isSuperUser}}
    {{> super_user_nav}}
  {{/if}}
  </table>
`);
export const render = (viewModel: ViewModel) =>
  pageTemplate(
    'Dashboard',
    O.some(viewModel.user)
  )(new SafeString(LANDING_PAGE_TEMPLATE(viewModel)));
