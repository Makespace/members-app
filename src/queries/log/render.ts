import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {html, safe, joinHtml, sanitizeString} from '../../types/html';
import {ViewModel, LogSearch} from './view-model';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {renderActor} from '../../types/actor';
import * as qs from 'qs';
import { renderPayload } from '../shared-render/render-payload';

const renderEntry =
  (search: LogSearch) => (event: ViewModel['events'][number]) => html`
  <li>
    ${
      event.deletedAt ? html`DELETED: ` : html``
    }
    <b>${sanitizeString(event.type)}</b> by ${renderActor(event.actor)} at
    ${displayDate(DateTime.fromJSDate(event.recordedAt))}<br />
    Event Index: ${sanitizeString(String(event.event_index))}<br />
    Event ID: ${sanitizeString(event.event_id)}<br />
    ${renderPayload(event)}
    ${
      event.deletedAt === null ?
        html`<form action=${deletePath(search)} method="get">
          <input type="hidden" name="eventIndex" value="${event.event_index}" />
          <button type="submit">Delete event</button>
        </form>` : html``
    }
  </li>
`;

const renderLog = (search: LogSearch) => (log: ViewModel['events']) =>
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

const searchToLink = (search: LogSearch) => {
  return safe(`/event-log?${qs.stringify(search)}`);
};

const deletePath = (search: LogSearch) =>
  safe(`/event-log/delete?${qs.stringify({next: searchToLink(search)})}`);

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
  <h1>Event log</h1>
  <p>Showing ${viewModel.events.length} of ${viewModel.count} events.</p>
  ${renderLog(viewModel.search)(viewModel.events)}
  <p>${renderPrevLink(viewModel)}</p>
  <p>${renderNextLink(viewModel)}</p>
`;
