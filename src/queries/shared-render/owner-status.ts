import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {html, safe, sanitizeString, joinHtml} from '../../types/html';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {OwnerOf} from '../../read-models/shared-state/return-types';

export const renderOwnerStatus = (ownerOf: ReadonlyArray<OwnerOf>) =>
  pipe(
    ownerOf,
    RA.map(
      area =>
        html`<li>
          <a href="/equipment#${safe(area.id)}">${sanitizeString(area.name)}</a>
          (since ${displayDate(DateTime.fromJSDate(area.ownershipRecordedAt))})
        </li>`
    ),
    RA.match(
      () => html`
        <p>You currently do not own any areas.</p>
        <p>
          Owners are the members who maintain and expand the capabilities of our
          areas. We are always looking for more.
        </p>
      `,
      listItems => html`
        <p>You are an owner of the following areas:</p>
        <ul>
          ${joinHtml(listItems)}
        </ul>
      `
    )
  );
