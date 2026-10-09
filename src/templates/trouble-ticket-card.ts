import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {DateTime} from 'luxon';
import {categoryDot} from './equipment-category';
import {commaHtml, html, Html, joinHtml, safe, sanitizeString} from '../types/html';
import {
  TroubleTicketView,
  AssigneeView,
  ChangeLogEntry,
} from '../queries/trouble-tickets/view-model';
import {renderMemberNumber} from './member-number';
import {STATUS_SLUG} from '../queries/trouble-tickets/status-slug';
import {displayDate} from './display-date';
import {TroubleTicketStatus} from '../types/trouble-ticket';

// How a trouble ticket is drawn. Shared so the board, the ticket's own page
// and anything else showing one are the same thing rather than three that
// drift apart.

// Where the form's answers were matched to a member, their name leads to
// their record: an owner reading a ticket usually wants to know who this is
// and what else they are trained on.
const renderSubmitter = (ticket: TroubleTicketView): Html => {
  const name = ticket.submittedName
    ? sanitizeString(ticket.submittedName)
    : ticket.submittedEmail
      ? sanitizeString(ticket.submittedEmail)
      : null;
  if (ticket.submittedMemberNumber !== null) {
    return name === null
      ? html`Member ${renderMemberNumber(ticket.submittedMemberNumber)}`
      : html`<a href="/member/${safe(String(ticket.submittedMemberNumber))}"
          >${name}</a
        >
        (${renderMemberNumber(ticket.submittedMemberNumber)})`;
  }
  // Nobody matched: what they typed is all there is.
  return name === null ? html`Not provided` : html`${name}`;
};

const renderEquipment = (ticket: TroubleTicketView) =>
  pipe(
    ticket.equipmentName,
    O.match(
      () =>
        pipe(
          ticket.areaName,
          O.match(
            () =>
              ticket.rawEquipment
                ? html`Unassigned
                    <small
                      >(form said:
                      ${sanitizeString(ticket.rawEquipment)})</small
                    >`
                : html`Unassigned`,
            areaName => html`${sanitizeString(areaName)} <small>(area)</small>`
          )
        ),
      name =>
        html`${pipe(
            ticket.equipmentCategory,
            O.match(
              () => html``,
              category => categoryDot(category)
            )
          )}${sanitizeString(name)}`
    )
  );

// When no machine resolved, renderEquipment already names the area, so this
// would say it twice. With a machine, the area is the missing half of where
// the thing actually is.
const renderArea = (ticket: TroubleTicketView) =>
  O.isNone(ticket.equipmentName)
    ? html``
    : pipe(
        ticket.areaName,
        O.match(
          () => html``,
          areaName =>
            html`<br /><strong>Area:</strong> ${sanitizeString(areaName)}`
        )
      );

const renderAssignee = (assignee: AssigneeView) =>
  pipe(
    assignee.name,
    O.match(
      () => html`${safe(`Member ${assignee.memberNumber}`)}`,
      name => html`${sanitizeString(name)}`
    )
  );

const renderAssignees = (assignees: ReadonlyArray<AssigneeView>) =>
  assignees.length === 0
    ? html`<em>Nobody assigned</em>`
    : commaHtml(assignees.map(renderAssignee));

const statusBadge = (status: TroubleTicketStatus) =>
  html`<span class="tt-badge tt-badge--${safe(STATUS_SLUG[status])}"
    >${safe(status)}</span
  >`;

// Actions available from the card, depending on the ticket's current status.
// Each links to a confirmation page (GET) that says exactly who will be
// emailed and what it will say, then POSTs the corresponding command. Nothing
// on the card itself sends an email - every change goes through that page,
// so nobody is surprised by what went out.
const renderActions = (ticket: TroubleTicketView): Html => {
  // Each action is a badge coloured by the status it moves the ticket to,
  // and says on hover who hears about it.
  const action = (
    verb: string,
    label: string,
    targetSlug: string,
    hint: string
  ) =>
    html`<a
      class="tt-badge tt-badge--${safe(targetSlug)} tt-action"
      href="/trouble-tickets/${safe(verb)}?ticketId=${safe(ticket.id)}&next=/trouble-tickets/board"
      title="${safe(hint)}"
      >${safe(label)}</a
    >`;
  const assign = (label: string) =>
    action(
      'assign',
      label,
      STATUS_SLUG['In Progress'],
      'Emails the submitter that you are on it'
    );
  // Resolve is offered from every open status, not just In Progress, so a
  // ticket that was actually dealt with long ago can be closed - quietly, via
  // the page's checkbox - without first sending an "in progress" email.
  const resolve = action(
    'resolve',
    'Resolve',
    STATUS_SLUG.Resolved,
    'Emails the submitter what you did - unless you choose not to'
  );
  switch (ticket.status) {
    case 'Todo':
      return html`<div class="tt-actions">
        ${assign('Mark In Progress')} ${resolve}
      </div>`;
    case 'In Progress':
      return html`<div class="tt-actions">
        ${resolve}
        ${action(
          'needs-help',
          'Needs Help',
          STATUS_SLUG['Needs Help'],
          "Emails the submitter and the machine's trainers"
        )}
        ${action(
          'park',
          'Park',
          STATUS_SLUG.Parked,
          'Emails the submitter why it is parked'
        )}
        ${ticket.assignedToMe ? html`` : assign('Assign to me')}
      </div>`;
    case 'Needs Help':
    case 'Parked':
      return html`<div class="tt-actions">
        ${assign('Mark In Progress')} ${resolve}
      </div>`;
    case 'Resolved':
      return html``;
  }
};

// Whether anyone was told about a change, and who. A quiet resolve was
// never going to email anybody; anything else is emailed within the
// minute, and the record of who says so here once it has been.
const renderEmailed = (entry: ChangeLogEntry): Html => {
  if (entry.emailedTo !== null) {
    return entry.emailedTo.length === 0
      ? html`<small class="tt-emailed"
          >No email sent: nobody had a usable address.</small
        >`
      : html`<small class="tt-emailed"
          >Emailed ${sanitizeString(entry.emailedTo.join(', '))}</small
        >`;
  }
  return entry.quiet
    ? html`<small class="tt-emailed"
        >No email sent: resolved quietly.</small
      >`
    : html``;
};

const renderChangeLog = (entries: ReadonlyArray<ChangeLogEntry>) => {
  if (entries.length === 0) {
    return html``;
  }
  return html`
    <details class="tt-changelog">
      <summary>Change log (${safe(entries.length.toString())})</summary>
      <ol class="tt-changelog__list">
        ${joinHtml(
          entries.map(
            entry => html`
              <li
                class="tt-log-entry tt-log-entry--${safe(
                  STATUS_SLUG[entry.status]
                )}"
              >
                <div>
                  <strong>${sanitizeString(entry.actor)}</strong>
                  ${sanitizeString(entry.summary)}
                  <small>${displayDate(DateTime.fromJSDate(entry.at))}</small>
                </div>
                ${renderEmailed(entry)}
                ${entry.details.length === 0
                  ? html``
                  : html`<ul class="tt-changelog__details">
                      ${joinHtml(
                        entry.details.map(
                          detail => html`<li>
                            <strong>${sanitizeString(detail.label)}:</strong>
                            ${sanitizeString(detail.value)}
                          </li>`
                        )
                      )}
                    </ul>`}
              </li>
            `
          )
        )}
      </ol>
    </details>
  `;
};

// A ticket raised from the mailbox is one step removed from the email that
// prompted it. The conversation is where the sender's own words, any reply,
// and the rest of the thread live, so the card says so and links there.
const renderOrigin = (ticket: TroubleTicketView) =>
  ticket.mailboxConversationId === null
    ? html``
    : html`<br /><strong>Raised from:</strong>
        <a
          href="/mailbox/${safe(encodeURIComponent(ticket.mailboxConversationId))}"
          >an email in the mailbox</a
        >`;

// One ticket, rendered the same wherever it appears: the board, its own
// page, and (in a plainer form, since email cannot reach this stylesheet)
// the notifications about it.
export const ticketCard = (
  ticket: TroubleTicketView,
  // Scope tokens the board's filter script reads. Empty elsewhere.
  scopes = '',
  // The ticket's own page has no use for a link to itself.
  linkTitle = true
) => html`
  <article
    class="trouble-ticket-card trouble-ticket-card--${safe(
      STATUS_SLUG[ticket.status]
    )} stack"
    data-status="${safe(STATUS_SLUG[ticket.status])}"
    data-scopes="${safe(scopes)}"
  >
    <div class="tt-card__header">
      ${statusBadge(ticket.status)}
      <h3>
        ${linkTitle
          ? html`<a href="/trouble-tickets/view/${safe(encodeURIComponent(ticket.id))}"
              >${sanitizeString(ticket.title)}</a
            >`
          : html`${sanitizeString(ticket.title)}`}
      </h3>
    </div>
    <p>
      <strong>Equipment:</strong> ${renderEquipment(ticket)}${renderArea(
        ticket
      )}<br />
      <strong>Submitted by:</strong> ${renderSubmitter(ticket)} on
      ${displayDate(DateTime.fromJSDate(ticket.submittedAt))}<br />
      <strong>Assigned:</strong> ${renderAssignees(ticket.assignees)}
      ${renderOrigin(ticket)}
    </p>
    <dl>
      <dt><strong>Machine status</strong></dt>
      <dd>${sanitizeString(ticket.response.status)}</dd>
      <dt><strong>Attempting</strong></dt>
      <dd>${sanitizeString(ticket.response.attempting)}</dd>
      <dt><strong>Issue</strong></dt>
      <dd>${sanitizeString(ticket.response.issue)}</dd>
      <dt><strong>Steps taken</strong></dt>
      <dd>${sanitizeString(ticket.response.steps)}</dd>
    </dl>
    ${renderChangeLog(ticket.changeLog)}
    ${ticket.canChangeStatus ? renderActions(ticket) : html``}
  </article>
`;
