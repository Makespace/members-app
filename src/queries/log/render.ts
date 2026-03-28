import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {html, safe, joinHtml} from '../../types/html';
import {ViewModel, LogSearch} from './view-model';
import * as qs from 'qs';
import { renderEvent } from '../shared-render/render-domain-event';

const renderLog = (log: ViewModel['events']) =>
  pipe(
    log,
    RA.map(event => 
      html`
        <li>
          [<a href=/events/exclude-event?event_id=${event.event_id}>Delete</a>] ${renderEvent(event)}
        </li>
      `
    ),
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
  ${renderLog(viewModel.events)}
  <p>${renderPrevLink(viewModel)}</p>
  <p>${renderNextLink(viewModel)}</p>
`;
