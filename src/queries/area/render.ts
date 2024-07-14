import {ViewModel} from './view-model';
import * as O from 'fp-ts/Option';
import {pageTemplate} from '../../templates';
import Handlebars, {SafeString} from 'handlebars';

Handlebars.registerPartial(
  'owners_list',
  `
    <ul>
      {{#each area.owners}}
        <li>{{this}}</li>
      {{/each}}
    </ul>
  `
);

Handlebars.registerPartial(
  'add_red_equipment_link',
  `
    <a href="/equipment/add?area={{area.id}}">Add piece of red equipment</a>
  `
);

Handlebars.registerPartial(
  'add_owner_link',
  `
    <a href="/areas/add-owner?area={{area.id}}">Add owner</a>
  `
);

Handlebars.registerPartial(
  'equipment_list',
  `
    <ul>
      {{#each equipment}}
        <li><a href="/equipment/{{this.id}}">{{this.name}}</a></li>
      {{/each}}
    </ul>
  `
);

const RENDER_AREA_TEMPLATE = Handlebars.compile(`
  <h1>{{area.name}}</h1>
  {{#if isSuperUser}}
    {{> add_red_equipment_link }}
  {{/if}}
  <h2>Owners</h2>
  {{#if isSuperUser}}
    {{> add_owner_link }}
  {{/if}}
  {{> owners_list }}
  <h2>Equipment</h2>
  {{> equipment_list }}
`);

export const render = (viewModel: ViewModel) =>
  pageTemplate(
    viewModel.area.name,
    viewModel.user
  )(new SafeString(RENDER_AREA_TEMPLATE(viewModel)));
