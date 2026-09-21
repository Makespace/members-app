import {
  html,
  HtmlSubstitution,
  joinHtml,
  safe,
  sanitizeString,
} from '../../types/html';
import {ViewModel} from './view-model';
import {DateTime} from 'luxon';
import {displayDate} from '../../templates/display-date';
import {renderMemberNumber} from '../../templates/member-number';
import {TroubleTicket} from '../../types/trouble-ticket';

const RESPONSE_LABELS: ReadonlyArray<
  [keyof TroubleTicket['response'], string]
> = [
  ['status', 'Machine status'],
  ['attempting', 'Attempting'],
  ['issue', 'Issue'],
  ['steps', 'Steps taken'],
  ['otherEquipmentDetail', 'Other equipment detail'],
];

const renderResponse = (
  response: TroubleTicket['response']
): HtmlSubstitution =>
  joinHtml(
    RESPONSE_LABELS.filter(([field]) => response[field] !== '').map(
      ([field, label]) => html`
        <p><strong>${safe(label)}:</strong> ${sanitizeString(response[field])}</p>
      `
    )
  );

const troubleTicketRows = (
  tickets: ReadonlyArray<TroubleTicket>
): ReadonlyArray<HtmlSubstitution> =>
  tickets.map(
    ticket => html`
      <tr>
        <td>${displayDate(DateTime.fromJSDate(ticket.submittedAt))}</td>
        <td>
          ${ticket.submittedEmail
            ? sanitizeString(ticket.submittedEmail)
            : safe('Not Provided')}
        </td>
        <td>
          ${ticket.submittedMemberNumber
            ? renderMemberNumber(ticket.submittedMemberNumber)
            : safe('Not Provided')}
        </td>
        <td>
          ${ticket.submittedEquipment
            ? sanitizeString(ticket.submittedEquipment)
            : safe('Not Provided')}
        </td>
        <td>${renderResponse(ticket.response)}</td>
      </tr>
    `
  );

export const render = (viewModel: ViewModel) =>
  viewModel.tickets.length > 0
    ? html`
        <div class="stack">
          <h1>Trouble tickets (last 6 months)</h1>
          <table>
            <tr>
              <th>Submitted</th>
              <th>Email Address</th>
              <th>Member Number</th>
              <th>Equipment</th>
              <th>Response</th>
            </tr>
            ${joinHtml(troubleTicketRows(viewModel.tickets))}
          </table>
        </div>
      `
    : html`<p>No trouble ticket data available</p>`;
