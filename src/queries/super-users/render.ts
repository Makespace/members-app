import * as O from 'fp-ts/Option';
import {ViewModel} from './view-model';
import {pageTemplate} from '../../templates';
import Handlebars, {SafeString} from 'handlebars';

Handlebars.registerPartial(
  'super_users_table',
  `
    {{#if superUsers}}
      <table>
        <tr>
          <th>Member Number</th>
          <th>SU since</th>
          <th></th>
        </tr>
        {{#each superUsers}}
          <tr>
            <td>{{member_number this.memberNumber}}</td>
            <td>{{display_date this.since}}</td>
            <td>
              <a href="/super-users/revoke?memberNumber={{this.memberNumber}}">
                Revoke
              </a>
            </td>
          </tr>
        {{/each}}
      </table>
    {{else}}
      <p>Currently no super-users</p>
    {{/if}}
  `
);

const SUPER_USERS_TEMPLATE = Handlebars.compile(`
  <h1>Super-users</h1>
  <a href="/super-users/declare">Declare a member to be a super-user</a>
  </table>
  {{> super_users_table}}
`);

export const render = (viewModel: ViewModel) =>
  pageTemplate(
    'Super Users',
    viewModel.user
  )(new SafeString(SUPER_USERS_TEMPLATE(viewModel)));
