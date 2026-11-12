import {html, safe, sanitizeString} from '../types/html';
import {BoardTicketView} from '../queries/trouble-tickets/view-model';

export const ticketPlusOne = (
  ticket: Pick<
    BoardTicketView,
    'id' | 'title' | 'hasPlusOne' | 'plusOneCount'
  >,
  returnTo: string
) => html`
  <form
    class="tt-plus-one"
    method="post"
    action="/trouble-tickets/set-plus-one?next=${safe(
      encodeURIComponent(returnTo)
    )}"
  >
    <input type="hidden" name="ticketId" value="${safe(ticket.id)}" />
    <input
      type="hidden"
      name="plusOne"
      value="${safe(String(!ticket.hasPlusOne))}"
    />
    <button
      type="submit"
      class="tt-plus-one__button"
      aria-pressed="${safe(String(ticket.hasPlusOne))}"
      aria-label="${safe(
        ticket.hasPlusOne ? 'Remove your +1' : 'Add your +1'
      )}: ${sanitizeString(ticket.title)} (${safe(
        String(ticket.plusOneCount)
      )} votes)"
      title="${safe(ticket.hasPlusOne ? 'Remove your +1' : 'Add your +1')}"
    >
      <img
        src="/static/makespace-plus-one.svg"
        alt=""
        width="44"
        height="44"
      />
      <span>${safe(String(ticket.plusOneCount))}</span>
    </button>
  </form>
`;
