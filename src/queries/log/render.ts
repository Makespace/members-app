import {pipe} from 'fp-ts/lib/function';
import {ViewModel} from './view-model';
import {Actor} from '../../types/actor';
import {DomainEvent} from '../../types';
import {inspect} from 'node:util';
import {pageTemplate} from '../../templates';
import * as O from 'fp-ts/Option';
import Handlebars, {SafeString} from 'handlebars';

Handlebars.registerHelper('render_actor', (actor: Actor) => {
  switch (actor.tag) {
    case 'system':
      return 'System';
    case 'token':
      return 'Admin via API';
    case 'user':
      return actor.user.emailAddress;
  }
});

Handlebars.registerHelper('render_event_payload', (event: DomainEvent) =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
  pipe(event, ({type, actor, recordedAt, ...payload}) => {
    return Object.entries(payload)
      .map(([key, value]) => `${key}: ${inspect(value)}`)
      .join(', ');
  })
);

const RENDER_LOG_TEMPLATE = Handlebars.compile(`
  <h1>Event log</h1>
  <p>Most recent at top</p>
  <ul>
    {{#each events}}
      <li>
        <b>{{this.type}}</b> by {{render_actor this.actor}} at
        {{display_date this.recordedAt}}<br />
        {{render_event_payload this}}
      </li>
    {{/each}}
  </ul>
`);

export const render = (viewModel: ViewModel) =>
  pageTemplate(
    'Event Log',
    viewModel.user
  )(new SafeString(RENDER_LOG_TEMPLATE(viewModel)));
