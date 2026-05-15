import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {Html, html, joinHtml} from '../../types/html';
import {ViewModel} from './view-model';
import { renderDeletedEvent } from '../shared-render/render-deleted-event';

const renderEntry =
  (event: ViewModel['events'][number]) => html`
    <li>
      ${renderDeletedEvent(event, {undeleteButton: {next: '/event-log/deleted'}})}
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

export const render = (viewModel: ViewModel): Html => html`
  <h1>Deleted events</h1>
  <p>Showing ${viewModel.events.length} deleted events.</p>
  ${renderLog(viewModel.events)}
`;
