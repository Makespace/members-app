import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';
import {inspect} from 'node:util';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {renderActor} from '../../types/actor';
import * as qs from 'qs';
import { Int } from 'io-ts';

const renderPayload = (event: ViewModel['events'][number]) =>
  pipe(
    event,
    ({type, actor, recordedAt, event_index, event_id, deletedAt, ...payload}) =>
      pipe(
        payload,
        Object.entries,
        RA.map(([key, value]) => `${key}: ${inspect(value)}`),
        RA.map(sanitizeString),
        joinHtml
      )
  );

const undeletePath = (eventIndex: Int) =>
  safe(`/event-log/undelete?${qs.stringify({eventIndex})}}`);

const renderEntry =
  (event: ViewModel['events'][number]) => html`
    <li>
      <b>${sanitizeString(event.type)}</b> by ${renderActor(event.actor)} at
      ${displayDate(DateTime.fromJSDate(event.recordedAt))}<br />
      Deleted at ${displayDate(DateTime.fromJSDate(event.deletedAt))}<br />
      Event Index: ${sanitizeString(String(event.event_index))}<br />
      Event ID: ${sanitizeString(event.event_id)}<br />
      ${renderPayload(event)}
      <form action=${undeletePath(event.event_index)} method="post">
        <input type="hidden" name="eventIndex" value="${event.event_index}" />
        <button type="submit">Un-delete event</button>
      </form>
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
  <h1>Deleted events</h1>
  <p>Showing ${viewModel.events.length} deleted events.</p>
  <p><a href=${safe('/event-log')}>View active event log</a></p>
  ${renderLog(viewModel.events)}
`;
