import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {html, safe, joinHtml, sanitizeString} from '../../types/html';
import {ViewModel, LogSearch} from './view-model';
import {inspect} from 'node:util';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {renderActor} from '../../types/actor';
import * as qs from 'qs';

const renderPayload = (event: ViewModel['events'][number]) =>
  // eslint-disable-next-line unused-imports/no-unused-vars
  pipe(
    event,
    ({type, actor, recordedAt, event_index, event_id, deleted, ...payload}) =>
      pipe(
        payload,
        Object.entries,
        RA.map(([key, value]) => `${key}: ${inspect(value)}`),
        RA.map(sanitizeString),
        joinHtml
      )
  );

const renderDeleteLink = (
  event: ViewModel['events'][number],
  search: LogSearch
) =>
  event.deleted === null
    ? pipe(
        {
          eventId: event.event_id,
          next: searchToLink(search).toString(),
        },
        qs.stringify,
        query => safe(`/event-log/delete?${query}`),
        href => html`<a href=${href}>Delete this event</a>`
      )
    : html``;

const renderDeleted = (event: ViewModel['events'][number]) =>
  event.deleted === null
    ? html``
    : html`
        <br />
        <strong>Deleted</strong> by ${renderActor(event.deleted.deletedBy)}:
        ${sanitizeString(event.deleted.reason)}
      `;

const renderEntry = (event: ViewModel['events'][number], search: LogSearch) => html`
  <li>
    <b>${sanitizeString(event.type)}</b> by ${renderActor(event.actor)} at
    ${displayDate(DateTime.fromJSDate(event.recordedAt))}<br />
    Event Index: ${sanitizeString(String(event.event_index))}<br />
    Event ID: ${sanitizeString(event.event_id)}<br />
    ${renderPayload(event)}
    ${renderDeleted(event)}<br />
    ${renderDeleteLink(event, search)}
  </li>
`;

const renderLog = (viewModel: ViewModel) =>
  pipe(
    viewModel.events,
    RA.map(event => renderEntry(event, viewModel.search)),
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
  ${renderLog(viewModel)}
  <p>${renderPrevLink(viewModel)}</p>
  <p>${renderNextLink(viewModel)}</p>
`;
