import { Int } from "io-ts";
import { DeletedStoredDomainEvent } from "../../types";
import { html, safe, sanitizeString } from "../../types/html";
import qs from "qs";
import { renderPayload } from "./render-payload";
import { renderActor } from "../../types/actor";
import { displayDate } from "../../templates/display-date";
import { DateTime } from "luxon/src/datetime";
import { renderMemberNumber } from "../../templates/member-number";

const undeletePath = <const T extends String>(eventIndex: Int, next: T) =>
  safe(
    `/event-log/undelete?${qs.stringify({
      eventIndex,
      next,
    })}`
  );

export const renderDeletedEvent = <const T extends String>(
    event: DeletedStoredDomainEvent,
    opts: {
        undeleteButton: false | {
            next: T
        },
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
        opts.undeleteButton ? html`
            <form action=${undeletePath(event.event_index, opts.undeleteButton.next)} method="get">
            <button type="submit">Un-delete event</button>
        ` : html``
    }
    </form>
  `;

