import {html, safe, sanitizeString} from '../../types/html';
import {ticketCard} from '../../templates/trouble-ticket-card';
import {TroubleTicketView} from '../trouble-tickets/view-model';

// A ticket on its own, at an address worth sending somebody. The card is the
// same one the board draws, so a ticket does not look like two different
// things depending on how it was reached.
export const render = (ticket: TroubleTicketView) => html`
  <div class="stack">
    <p>
      <a href="/trouble-tickets/board">&larr; All trouble tickets</a>
    </p>
    ${ticketCard(ticket, '', false)}
  </div>
`;

export const pageTitle = (ticket: TroubleTicketView) =>
  ticket.title === ''
    ? safe('Trouble ticket')
    : sanitizeString(ticket.title);
