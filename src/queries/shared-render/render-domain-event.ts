import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {html, safe, joinHtml, sanitizeString} from '../../types/html';
import {StoredDomainEvent} from '../../types';
import {inspect} from 'node:util';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {renderActor} from '../../types/actor';

const renderPayload = (event: StoredDomainEvent) =>
  // eslint-disable-next-line unused-imports/no-unused-vars
  pipe(event, ({event_id, type, actor, recordedAt, ...payload}) =>
    pipe(
      payload,
      Object.entries,
      RA.map(([key, value]) => `${key}: ${inspect(value)}`),
      RA.map(sanitizeString),
      joinHtml
    )
  );

export const renderEvent = (event: StoredDomainEvent) => html`
  <li>
    <b>${sanitizeString(event.type)}</b> by ${renderActor(event.actor)} at
    ${displayDate(DateTime.fromJSDate(event.recordedAt))}
    ${event.event_id ? html`<br />Event id: ${sanitizeString(event.event_id)}` : safe('')}<br />
    ${renderPayload(event)}
  </li>
`;
