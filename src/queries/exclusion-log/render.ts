import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {html, joinHtml, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';
import {DomainEvent} from '../../types';
import {inspect} from 'node:util';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';
import { renderMemberNumber } from '../../templates/member-number';

const renderPayload = (event: DomainEvent) =>
  // eslint-disable-next-line unused-imports/no-unused-vars
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
    <b>EXCLUDED by ${renderMemberNumber(event.reverted_by_number)} at ${displayDate(DateTime.fromJSDate(event.revert_at))}
    because '${sanitizeString(event.revert_reason)}'.</b>
    <br />
    Event id: ${sanitizeString(event.event_id)}
    <br />
    ${renderPayload(event.payload)}
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
  <p>There are ${viewModel.events.length} excluded events</p>
  ${renderLog(viewModel.events)}
`;
