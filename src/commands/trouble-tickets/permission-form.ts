import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {UUID} from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Form} from '../../types/form';
import {TroubleTicket} from '../../types/trouble-ticket';
import {
  html,
  safe,
  sanitizeString,
  joinHtml,
  toLoggedInContent,
} from '../../types/html';
import {failureWithStatus} from '../../types/failure-with-status';
import {isTicketOwner} from './authorization';
import {TicketPermission} from '../../types/trouble-ticket-permission';

const groups: ReadonlyArray<{group: TicketPermission; label: string}> = [
  {group: 'everybody', label: 'Everybody'},
  {group: 'area-owner', label: 'Area Owners'},
  {group: 'manager', label: 'Management'},
];

export const permissionForm: Form<TroubleTicket> = {
  formIsAuthorized: null,
  constructForm:
    input =>
    ({user, deps, readModel}) =>
      pipe(
        t.type({ticketId: UUID}).decode(input),
        E.mapLeft(() =>
          failureWithStatus('Invalid ticket', StatusCodes.BAD_REQUEST)()
        ),
        E.filterOrElse(
          value =>
            isTicketOwner({
              actor: {tag: 'user', user},
              rm: readModel,
              deps,
              input: value,
            }),
          () =>
            failureWithStatus(
              'You cannot change this ticket’s visibility',
              StatusCodes.FORBIDDEN
            )()
        ),
        E.chain(({ticketId}) =>
          pipe(
            readModel.troubleTickets.getById(ticketId),
            E.fromOption(() =>
              failureWithStatus(
                'No such trouble ticket',
                StatusCodes.NOT_FOUND
              )()
            )
          )
        ),
        TE.fromEither
      ),
  renderForm: ticket =>
    pipe(
      html`
        <div class="stack">
          <h1>Who can view this ticket?</h1>
          <p>${sanitizeString(ticket.title)}</p>
          <p>
            Only the selected group and super-users can view the ticket and its
            history.
          </p>
          <form
            method="post"
            action="/trouble-tickets/set-permission?next=/trouble-tickets/board"
            class="stack"
          >
            <input type="hidden" name="ticketId" value="${safe(ticket.id)}" />
            <fieldset class="stack">
              <legend>Visibility</legend>
              ${joinHtml(
                groups.map(
                  ({group, label}) => html`
                    <label class="checkbox-row">
                      <input
                        type="radio"
                        name="permission"
                        value="${safe(group)}"
                        required
                        ${ticket.permission === group
                          ? html`checked`
                          : html``}
                      />
                      <span>${safe(label)}</span>
                    </label>
                  `
                )
              )}
            </fieldset>
            <p>
              Removing your own access means you cannot change this again.
            </p>
            <div class="tt-actions">
              <button type="submit">Save visibility</button>
              <a href="/trouble-tickets/view/${safe(ticket.id)}">Cancel</a>
            </div>
          </form>
        </div>
      `,
      toLoggedInContent(safe('Ticket visibility'))
    ),
};
