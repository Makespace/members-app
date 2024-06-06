import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {html} from '../../types/html';
import {ViewModel} from './view-model';
import {Actor} from '../../types/actor';
import {DomainEvent} from '../../types';

const renderActor = (actor: Actor) => {
  switch (actor.tag) {
    case 'system':
      return 'System';
    case 'token':
      return 'Admin via API';
    case 'user':
      return actor.user.emailAddress;
  }
};

const renderPayload = (event: DomainEvent) =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
  pipe(event, ({type, actor, ...payload}) => {
    return Object.entries(payload)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  });

const renderEntry = (event: ViewModel['events'][number]) => html`
  <li>
    <b>${event.type}</b> by ${renderActor(event.actor)}<br />
    ${renderPayload(event)}
  </li>
`;

const renderLog = (log: ViewModel['events']) =>
  pipe(
    log,
    RA.map(renderEntry),
    items => html`
      <ul>
        ${items.join('\n')}
      </ul>
    `
  );

export const render = (viewModel: ViewModel) => html`
  <h1>Event log</h1>
  <p>From most recent to oldest</p>
  ${renderLog(viewModel.events)}
`;
