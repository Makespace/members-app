import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
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
import {TroubleTicketDataTable} from '../../sync-worker/google/sheet-data-table';

const troubleTicketRows = (
  ttr: TroubleTicketDataTable['rows']
): ReadonlyArray<HtmlSubstitution> => {
  return ttr.map(
    ticket => html`
      <tr>
        <td>${displayDate(DateTime.fromJSDate(ticket.response_submitted))}</td>
        <td>
          ${ticket.submitted_email
            ? sanitizeString(ticket.submitted_email)
            : safe('Not Provided')}
        </td>
        <td>
          ${ticket.submitted_membership_number
            ? renderMemberNumber(ticket.submitted_membership_number)
            : safe('Not Provided')}
        </td>
        <td>
          ${ticket.submitted_equipment
            ? sanitizeString(ticket.submitted_equipment)
            : safe('Not Provided')}
        </td>
        <td>
          ${sanitizeString(JSON.stringify(ticket.submitted_response_json))}
        </td>
      </tr>
    `
  );
};

export const render = (viewModel: ViewModel) =>
  pipe(viewModel, (viewModel: ViewModel) =>
    O.isSome(viewModel.troubleTicketData)
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
              ${joinHtml(troubleTicketRows(viewModel.troubleTicketData.value))}
            </table>
          </div>
        `
      : html`<p>No trouble ticket data available</p>`
  );
