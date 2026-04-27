import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {DeletedEventsSearch, ViewModel} from './view-model';
import {inspect} from 'node:util';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {renderActor} from '../../types/actor';
import * as qs from 'qs';

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

const searchToLink = (search: DeletedEventsSearch) =>
  safe(`/event-log/deleted?${qs.stringify(search)}`);

const undeletePath = (search: DeletedEventsSearch) =>
  safe(`/event-log/undelete?${qs.stringify({next: searchToLink(search)})}`);

const renderEntry =
  (search: DeletedEventsSearch) => (event: ViewModel['events'][number]) => html`
    <li>
      <b>${sanitizeString(event.type)}</b> by ${renderActor(event.actor)} at
      ${displayDate(DateTime.fromJSDate(event.recordedAt))}<br />
      Deleted at ${displayDate(DateTime.fromJSDate(event.deletedAt))}<br />
      Event Index: ${sanitizeString(String(event.event_index))}<br />
      Event ID: ${sanitizeString(event.event_id)}<br />
      ${renderPayload(event)}
      <form action=${undeletePath(search)} method="post">
        <input type="hidden" name="eventIndex" value="${event.event_index}" />
        <button type="submit">Un-delete event</button>
      </form>
    </li>
  `;

const renderLog = (search: DeletedEventsSearch) => (log: ViewModel['events']) =>
  pipe(
    log,
    RA.map(renderEntry(search)),
    joinHtml,
    items => html`
      <ul>
        ${items}
      </ul>
    `
  );

const paginationAmount = (viewModel: ViewModel) => viewModel.search.limit ?? 10;

const renderPrevLink = (viewModel: ViewModel) =>
  pipe(
    viewModel.search,
    ({offset, ...args}) => ({
      offset: Math.max(offset - paginationAmount(viewModel), 0),
      ...args,
    }),
    searchToLink,
    link => html`<a href=${link}>Prev</a>`
  );

const renderNextLink = (viewModel: ViewModel) =>
  pipe(
    viewModel.search,
    ({offset, ...args}) => ({
      offset: offset + paginationAmount(viewModel),
      ...args,
    }),
    searchToLink,
    link => html`<a href=${link}>Next</a>`
  );

export const render = (viewModel: ViewModel) => html`
  <h1>Deleted events</h1>
  <p>Showing ${viewModel.events.length} of ${viewModel.count} deleted events.</p>
  <p><a href=${safe('/event-log')}>View active event log</a></p>
  ${renderLog(viewModel.search)(viewModel.events)}
  <p>${renderPrevLink(viewModel)}</p>
  <p>${renderNextLink(viewModel)}</p>
`;
