import {DateTime} from 'luxon';
import {DeletedStoredDomainEvent} from '../../types';
import {renderActor} from '../../types/actor';
import {html, sanitizeString} from '../../types/html';
import {displayDate} from '../../templates/display-date';
import {renderMemberNumber} from '../../templates/member-number';
import {renderPayload} from './render-payload';

// const undeletePath = safe('/event-log/undelete');

export const renderDeletedEvent = <const T extends string>(
  event: DeletedStoredDomainEvent,
  _opts: {
    undeleteButton: false | {
      next: T;
    };
  },
) => html`
  <b>${sanitizeString(event.type)}</b> by ${renderActor(event.actor)} at
  ${displayDate(DateTime.fromJSDate(event.recordedAt))}<br />
  Deleted at ${displayDate(DateTime.fromJSDate(event.deletedAt))}<br />
  Deleted by ${renderMemberNumber(event.markDeletedByMemberNumber)}<br />
  Reason '${sanitizeString(event.deleteReason)}'<br />
  Event Index: ${sanitizeString(String(event.event_index))}<br />
  Event ID: ${sanitizeString(event.event_id)}<br />
  ${renderPayload(event)}
  ${
    // Temporarily disabled due to performance impact of the reload
    html``
    // opts.undeleteButton ? html`
    //   <form action="${undeletePath}" method="get">
    //     <input type="hidden" name="eventIndex" value="${event.event_index}" />
    //     <input type="hidden" name="next" value="${safe(opts.undeleteButton.next)}" />
    //     <button type="submit">Un-delete event</button>
    //   </form>
    // ` : html``
    }
`;
