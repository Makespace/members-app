import * as O from 'fp-ts/Option';
import {ViewModel} from './view-model';
import {pageTemplate} from '../../templates';
import Handlebars, {SafeString} from 'handlebars';

Handlebars.registerPartial(
  'areas_table',
  `
  {{#if areas}}
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Owners</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {{#each areas}}
          <tr>
            <td><a href="/areas/{{this.id}}">{{this.name}}</a></td>
            <td>
              {{#each owners}}
                {{#member_number this}}
              {{/each}}
            </td>
            <td><a href="/areas/add-owner?area={{this.id}}">Add owner</a></td>
          </tr>
        {{/each}}
      </tbody>
    </table>
  {{else}}
    <p>Currently no Areas</p>
  {{/if}}
  `
);

Handlebars.registerPartial(
  'add_area_link',
  '<a href="/areas/create">Add area of responsibility</a>'
);

const RENDER_AREAS_TEMPLATE = Handlebars.compile(`
  <h1>Areas of Makespace</h1>
  {{#if isSuperUser }}
    {{> add_area_link}}
  {{/if}}
  {{> areas_table}}
`);
export const render = (viewModel: ViewModel) =>
  pageTemplate(
    'Areas',
    O.some(viewModel.user)
  )(new SafeString(RENDER_AREAS_TEMPLATE(viewModel)));
