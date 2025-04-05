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

const troubleTicketRows = (
  viewModel: ViewModel
): ReadonlyArray<HtmlSubstitution> => {
  return viewModel.troubleTicketData.map(
    ticket => html`
      <tr>
        <td>${displayDate(DateTime.fromJSDate(ticket.responseSubmitted))}</td>
        <td>
          ${O.isNone(ticket.emailAddress)
            ? safe('Not Provided')
            : sanitizeString(ticket.emailAddress.value)}
        </td>
        <td>
          ${O.isNone(ticket.submitterMembershipNumber)
            ? safe('Not Provided')
            : renderMemberNumber(ticket.submitterMembershipNumber.value)}
        </td>
        <td>
          ${O.isNone(ticket.whichEquipment)
            ? safe('Not Provided')
            : sanitizeString(ticket.whichEquipment.value)}
        </td>
        <td>${sanitizeString(JSON.stringify(ticket.submittedResponse))}</td>
      </tr>
    `
  );
};

export const render = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    (viewModel: ViewModel) => html`
      <div class="stack">
        <h1>Trouble tickets</h1>
        <table>
          <tr>
            <th>Submitted</th>
            <th>Email Address</th>
            <th>Member Number</th>
            <th>Equipment</th>
            <th>Response</th>
          </tr>
          ${joinHtml(troubleTicketRows(viewModel))}
        </table>
      </div>
    `
  );
