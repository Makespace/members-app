import {pageTemplate} from '../../templates';
import {ViewModel} from './view-model';
import * as O from 'fp-ts/Option';
import Handlebars, {SafeString} from 'handlebars';

Handlebars.registerPartial(
  'trainers_list',
  `
<h2>Trainers</h2>
<ul>
  {{#each equipment.trainers}}
    <li>{{member_number this}}</li>
  {{else}}
    <p>This equipment needs trainers.</p>
  {{/each}}
</ul>
`
);

Handlebars.registerPartial(
  'trainer_equipment_actions',
  `
{{#with equipment}}
<li>
  <a
    href="/equipment/mark-member-trained?equipmentId={{id}}"
    >Mark member as trained</a
  >
</li>
{{/with}}
`
);

Handlebars.registerPartial(
  'owner_equipment_actions',
  `
{{#with equipment}}
<li>
  <a href="/equipment/add-trainer?equipment={{id}}"
    >Add a trainer</a
  >
</li>
<li>
  <a
    href="/equipment/add-training-sheet?equipmentId={{id}}"
    >Register training sheet</a
  >
</li>
{{/with}}
`
);

Handlebars.registerPartial(
  'equipment_actions',
  `
<ul>
{{#if isSuperUserOrOwnerOfArea}}
  {{> owner_equipment_actions }}
{{/if}}
{{#if isSuperUserOrTrainerOfArea}}
  {{> trainer_equipment_actions }}
{{/if}}
</ul>
`
);

Handlebars.registerPartial(
  'currently_trained_users_table',
  `
<h2>Currently Trained Users</h2>
<table>
  <tr>
    <th>Member Number</th>
  </tr>
  {{#with equipment}}
    {{#each trainedMembers}}
      <tr><td>{{member_number this}}</td></tr>
    {{/each}}
  {{/with}}
</table>
`
);

// TODO
// 1. Realistically people only care about training quiz results for people who have passed the quiz and aren't already signed off.
// 2. Dates aren't displayed using the users locale.
Handlebars.registerPartial(
  'training_quiz_results_table',
  `
<table>
  <tr>
    <th>Timestamp</th>
    <th>Email</th>
    <th>Score</th>
  </tr>
  {{#each results}}
    {{#if this.passed}}
      <tr class=passed_training_quiz_row>
    {{else}}
      <tr class=failed_training_quiz_row>
    {{/if}}
      <td>{{display_date this.timestamp}}</td>
      <td>{{this.email}}</td>
      <td>
        {{this.score}} / {{this.maxScore}} ({{this.percentage}}%)
      </td>
    </tr>
    {{else}}
      <p>No one is waiting for training</p>
  {{/each}}
</table>
`
);

Handlebars.registerPartial(
  'training_quiz_results',
  `
<h2>Training Quiz Results</h2>
<h3>Waiting for Training</h3>
{{#with trainingQuizResults}}
  {{> training_quiz_results_table results=passed }}
<h3>All Results</h3>
  {{> training_quiz_results_table results=all }}
{{/with}}
`
);

const RENDER_EQUIPMENT_TEMPLATE = Handlebars.compile(
  `
  <h1>{{equipment_name}}</h1>
  {{> equipment_actions }}
  {{> trainers_list }}
  {{> currently_trained_users_table }}
  {{> training_quiz_results }}
  `
);

export const render = (viewModel: ViewModel) =>
  pageTemplate(
    viewModel.equipment.name,
    O.some(viewModel.user)
  )(new SafeString(RENDER_EQUIPMENT_TEMPLATE(viewModel)));
