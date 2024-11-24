import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {html, joinHtml, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';
import {DomainEvent} from '../../types';
import {inspect} from 'node:util';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {renderActor} from '../../types/actor';

const renderPayload = (event: DomainEvent) =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
  pipe(event, ({type, actor, recordedAt, ...payload}) =>
    pipe(
      payload,
      Object.entries,
      RA.map(([key, value]) => `${key}: ${inspect(value)}`),
      RA.map(sanitizeString),
      joinHtml
    )
  );

const renderEntry = (event: ViewModel['events'][number]) => html`
  <li>
    <b>${sanitizeString(event.type)}</b> by ${renderActor(event.actor)} at
    ${displayDate(DateTime.fromJSDate(event.recordedAt))}<br />
    ${renderPayload(event)}
  </li>
`;

const renderLog = (log: ViewModel['events']) =>
  pipe(
    log,
    RA.map(renderEntry),
    joinHtml,
    items => html`
      <ul>
        ${items}
      </ul>
    `
  );

export const render = (viewModel: ViewModel) => html`
  <h1>Event log</h1>
  <p>Most recent at top</p>
  ${renderLog(viewModel.events)}
`;
