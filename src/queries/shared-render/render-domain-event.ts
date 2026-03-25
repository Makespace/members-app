import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {html, safe, joinHtml, sanitizeString} from '../../types/html';
import {DomainEvent} from '../../types';
import {inspect} from 'node:util';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {renderActor} from '../../types/actor';

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

export const renderEvent = (event: DomainEvent) => html`
  <li>
    <b>${sanitizeString(event.type)}</b> by ${renderActor(event.actor)} at
    ${displayDate(DateTime.fromJSDate(event.recordedAt))}<br />
    ${renderPayload(event)}
  </li>
`;
