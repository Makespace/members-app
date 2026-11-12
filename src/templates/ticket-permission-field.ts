import {TicketPermission} from '../types/trouble-ticket-permission';
import {html, joinHtml, safe} from '../types/html';

const choices: ReadonlyArray<{value: TicketPermission; label: string}> = [
  {value: 'everybody', label: 'Everybody'},
  {value: 'area-owner', label: 'Area Owners'},
  {value: 'manager', label: 'Management'},
];

export const ticketPermissionField = (selected: TicketPermission = 'everybody') => html`
  <details class="stack tt-form__question">
    <summary>Advanced</summary>
    <label class="stack tt-permission-field">
      <strong>Visibility</strong>
      <small class="tt-form__hint" id="ticket-permission-hint">
        Only the selected group and super-users can view the ticket and its
        history.
      </small>
      <span class="tt-permission-field__control">
        <select name="permission" required aria-describedby="ticket-permission-hint">
          ${joinHtml(
            choices.map(
              choice => html`<option
                value="${safe(choice.value)}"
                ${choice.value === selected ? html`selected` : html``}
              >${safe(choice.label)}</option>`
            )
          )}
        </select>
      </span>
    </label>
  </details>
`;
