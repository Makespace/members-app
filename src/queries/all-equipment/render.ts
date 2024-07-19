import {ViewModel} from './view-model';
import {pageTemplate} from '../../templates';


Handlebars.registerPartial(
  'render_equipment_table',
  `
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Area</th>
      </tr>
    </thead>
    <tbody>
      {{#each equipment}}
        <tr>
          <td><a href="/equipment/{{this.id}}">{{this.name}}</a></td>
          <td>
            <a href="/areas/{{this.areaId}}">{{this.areaName}}</a>
          </td>
        </tr>
      {{else}}
        <p>Currently no Equipment</p>
      {{/each}}
    </tbody>
  </table>
  `
);

Handlebars.registerPartial(
  'add_area_link',
  '<a href="/areas/create">Add area of responsibility</a>'
);

const RENDER_ALL_EQUIPMENT_TEMPLATE = Handlebars.compile(
  `
  <h1>Equipment of Makespace</h1>
  {{#if isSuperUser}}
    {{> add_area_link }}
  {{/if}}
  {{> render_equipment_table }}
`
);

export const render = (viewModel: ViewModel) =>
  pageTemplate(
    'Equipment',
    viewModel.user
  )(new SafeString(RENDER_ALL_EQUIPMENT_TEMPLATE(viewModel)));
