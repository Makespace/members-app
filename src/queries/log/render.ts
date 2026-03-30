import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {html, safe, joinHtml, sanitizeString} from '../../types/html';
import {ViewModel, LogSearch} from './view-model';
import {inspect} from 'node:util';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {renderActor} from '../../types/actor';
import * as qs from 'qs';
import * as O from 'fp-ts/Option';

const renderPayload = (event: ViewModel['events'][number]) =>
  pipe(
    event,
    ({
      type: _type,
      actor: _actor,
      recordedAt: _recordedAt,
      event_index: _eventIndex,
      event_id: _eventId,
      deletion: _deletion,
      ...payload
    }) =>
      pipe(
        payload,
        Object.entries,
        RA.map(([key, value]) => `${key}: ${inspect(value)}`),
        RA.map(sanitizeString),
        joinHtml
      )
  );

const searchToLink = (search: LogSearch) => {
  return safe(`/event-log?${qs.stringify(search)}`);
};

const renderDeletion = (event: ViewModel['events'][number]) =>
  pipe(
    O.fromNullable(event.deletion),
    O.match(
      () => html``,
      deletion => html`
        <br />
        <b>Deleted</b> by member ${deletion.deletedByMemberNumber} at
        ${displayDate(DateTime.fromJSDate(deletion.deletedAt))}<br />
        Reason: ${sanitizeString(deletion.reason)}
      `
    )
  );

const renderDeleteForm = (event: ViewModel['events'][number]) =>
  event.deletion === null
    ? html`
        <a
          href="${safe(
            `/event-log/delete?${qs.stringify({
              eventId: event.event_id,
            })}`
          )}"
          >Delete event</a
        >
      `
    : html``;

const renderEntry = (event: ViewModel['events'][number], search: LogSearch) => html`
  <li>
    <b>${sanitizeString(event.type)}</b> by ${renderActor(event.actor)} at
    ${displayDate(DateTime.fromJSDate(event.recordedAt))}<br />
    Event Index: ${sanitizeString(String(event.event_index))}<br />
    Event ID: ${sanitizeString(event.event_id)}<br />
    ${renderPayload(event)}
    ${renderDeletion(event)}
    ${renderDeleteForm(event)}
  </li>
`;

const renderLog = (log: ViewModel['events'], search: LogSearch) =>
  pipe(
    log,
    RA.map(event => renderEntry(event, search)),
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
  <h1>Event log</h1>
  <p>Showing ${viewModel.events.length} of ${viewModel.count} events.</p>
  ${renderLog(viewModel.events, viewModel.search)}
  <p>${renderPrevLink(viewModel)}</p>
  <p>${renderNextLink(viewModel)}</p>
`;
