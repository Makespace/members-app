import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {
  commaHtml,
  html,
  joinHtml,
  safe,
  sanitizeString,
} from '../../types/html';
import {ViewModel, TroubleTicketView, AssigneeView} from './view-model';
import {DateTime} from 'luxon';
import {displayDate} from '../../templates/display-date';
import {TroubleTicketStatus} from '../../types/trouble-ticket';

// The order status columns are shown in - active work first, done last.
const STATUS_ORDER: ReadonlyArray<TroubleTicketStatus> = [
  'Todo',
  'In Progress',
  'Needs Help',
  'Parked',
  'Resolved',
];

const renderSubmitter = (ticket: TroubleTicketView) => {
  if (ticket.submittedName) {
    return sanitizeString(ticket.submittedName);
  }
  if (ticket.submittedEmail) {
    return sanitizeString(ticket.submittedEmail);
  }
  if (ticket.submittedMemberNumber !== null) {
    return safe(`Member ${ticket.submittedMemberNumber}`);
  }
  return safe('Not provided');
};

const renderEquipment = (ticket: TroubleTicketView) =>
  pipe(
    ticket.equipmentName,
    O.match(
      () =>
        ticket.rawEquipment
          ? html`Unassigned
              <small>(form said: ${sanitizeString(ticket.rawEquipment)})</small>`
          : html`Unassigned`,
      name => html`${sanitizeString(name)}`
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

const renderCard = (ticket: TroubleTicketView) => html`
  <article class="stack">
    <h3>${sanitizeString(ticket.title)}</h3>
    <p>
      <strong>Equipment:</strong> ${renderEquipment(ticket)}<br />
      <strong>Submitted by:</strong> ${renderSubmitter(ticket)} on
      ${displayDate(DateTime.fromJSDate(ticket.submittedAt))}<br />
      <strong>Assigned:</strong> ${renderAssignees(ticket.assignees)}
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
  </article>
`;

const renderStatusSection = (
  status: TroubleTicketStatus,
  tickets: ReadonlyArray<TroubleTicketView>
) =>
  tickets.length === 0
    ? html``
    : html`
        <section class="stack">
          <h2>${safe(status)} (${safe(tickets.length.toString())})</h2>
          ${joinHtml(tickets.map(renderCard))}
        </section>
      `;

export const render = (viewModel: ViewModel) => {
  if (viewModel.tickets.length === 0) {
    return html`
      <div class="stack">
        <h1>Trouble tickets</h1>
        <p>No trouble tickets yet.</p>
      </div>
    `;
  }
  return html`
    <div class="stack">
      <h1>Trouble tickets</h1>
      ${joinHtml(
        STATUS_ORDER.map(status =>
          renderStatusSection(
            status,
            viewModel.tickets.filter(ticket => ticket.status === status)
          )
        )
      )}
    </div>
  `;
};
