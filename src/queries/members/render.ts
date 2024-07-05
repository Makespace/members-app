import {pageTemplate} from '../../templates';
import {ViewModel} from './view-model';
import * as O from 'fp-ts/Option';
import Handlebars, {SafeString} from 'handlebars';

Handlebars.registerPartial(
  'render_members',
  `
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Member number</th>
          <th>Name</th>
          <th>Pronouns</th>
          <th>Email</th>
        </tr>
      </thead>
      <tbody>
      {{#each members}}
        <tr>
          <td>{{avatar_thumbnail this}}</td>
          <td>
            {{member_number this.number}}
          </td>
          <td>{{optional_detail this.name}}</td>
          <td>{{optional_detail this.pronouns}}</td>
          {{#if viewerIsSuperUser}}
            <td>{{member.email}}</td>
          {{else}}
            <td>'*****'</td>
          {{/if}}
        </tr>
      {{/each}}
      </tbody>
    </table>
  `
);

const RENDER_MEMBERS_TEMPLATE = Handlebars.compile(
  `
  <h1>Members of Makespace</h1>
  {{#if members}}
    {{> render_members}}
  {{else}}
    <p>Currently no members</p>
  {{/if}}
`
);

export const render = (viewModel: ViewModel) =>
  pageTemplate(
    'Members',
    O.some(viewModel.user)
  )(new SafeString(RENDER_MEMBERS_TEMPLATE(viewModel)));
