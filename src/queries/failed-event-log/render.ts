import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import * as qs from 'qs';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {FailedEventLogSearch, ViewModel} from './view-model';


const renderEntry = (failure: ViewModel['failures'][number]) => html`
  <li>
    <b>${sanitizeString(failure.error)}</b><br/>
    ${sanitizeString(JSON.stringify(failure.payload))}
  </li>
`;

const renderLog = (failures: ViewModel['failures']) =>
  pipe(
    failures,
    RA.map(renderEntry),
    joinHtml,
    items => html`
      <ul>
        ${items}
      </ul>
    `
  );

const searchToLink = (search: FailedEventLogSearch) =>
  safe(`/event-log/failed?${qs.stringify(search)}`);

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
  <h1>Failed event log</h1>
  <p>Showing ${viewModel.failures.length} of ${viewModel.count} failed events.</p>
  ${renderLog(viewModel.failures)}
  <p>${renderPrevLink(viewModel)}</p>
  <p>${renderNextLink(viewModel)}</p>
`;
