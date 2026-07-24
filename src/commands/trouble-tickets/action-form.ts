import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {UUID} from 'io-ts-types';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {
  html,
  Html,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';

// A trouble-ticket action confirmation page. Shows the ticket, a short explanation of what
// the action does, any required text fields, then a submit button that POSTs to the
// matching command. The command's own isAuthorized/decode enforce permission and required
// input; this is just the confirm + capture step.
type ActionViewModel = {ticketId: UUID; title: string};

type ActionConfig = {
  verb: string;
  pageTitle: string;
  intro: Html;
  fields?: Html;
  submitLabel: string;
};

// A required multi-line text field.
const textField = (name: string, label: string) => html`
  <label class="stack">
    <strong>${safe(label)}</strong>
    <textarea name="${safe(name)}" rows="3" required></textarea>
  </label>
`;

const troubleTicketActionForm = (
  config: ActionConfig
): Form<ActionViewModel> => {
  const renderForm: Form<ActionViewModel>['renderForm'] = viewModel =>
    pipe(
      html`
        <div class="stack">
          <h1>${safe(config.pageTitle)}</h1>
          <p>Ticket: <strong>${sanitizeString(viewModel.title)}</strong></p>
          <p>${config.intro}</p>
          <form
            action="/trouble-tickets/${safe(config.verb)}"
            method="post"
            class="stack"
          >
            <input
              type="hidden"
              name="ticketId"
              value="${safe(viewModel.ticketId)}"
            />
            ${config.fields ?? html``}
            <div class="tt-actions">
              <button type="submit">${safe(config.submitLabel)}</button>
              <a href="/trouble-tickets">Cancel</a>
            </div>
          </form>
        </div>
      `,
      toLoggedInContent(safe(config.pageTitle))
    );

  const constructForm: Form<ActionViewModel>['constructForm'] =
    input =>
    ({readModel}) =>
      pipe(
        input,
        t.type({ticketId: UUID}).decode,
        E.mapLeft(formatValidationErrors),
        E.mapLeft(
          failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)
        ),
        E.chain(({ticketId}) =>
          pipe(
            readModel.troubleTickets.getById(ticketId),
            E.fromOption(() =>
              failureWithStatus(
                'The requested trouble ticket does not exist',
                StatusCodes.NOT_FOUND
              )()
            ),
            E.map(ticket => ({ticketId, title: ticket.title}))
          )
        ),
        TE.fromEither
      );

  return {renderForm, constructForm, formIsAuthorized: null};
};

export const assignForm = troubleTicketActionForm({
  verb: 'assign',
  pageTitle: 'Assign this ticket to you',
  intro: html`This assigns the ticket to you and notifies the submitter. If it
  isn't already In Progress, it will be moved there.`,
  submitLabel: 'Assign to me',
});

export const resolveForm = troubleTicketActionForm({
  verb: 'resolve',
  pageTitle: 'Resolve ticket',
  intro: html`This marks the ticket as Resolved, unassigns everyone, and
  notifies the submitter.`,
  fields: textField('summary', 'What did you do to resolve this ticket?'),
  submitLabel: 'Resolve ticket',
});

export const needsHelpForm = troubleTicketActionForm({
  verb: 'needs-help',
  pageTitle: 'Flag as Needs Help',
  intro: html`This flags the ticket as Needs Help and unassigns you, then
  notifies the submitter and the machine's trainers so someone else can pick it
  up.`,
  fields: html`${textField('whatTried', 'What did you try?')}
  ${textField('whyDidntWork', "Why didn't it work?")}`,
  submitLabel: 'Flag Needs Help',
});

export const parkForm = troubleTicketActionForm({
  verb: 'park',
  pageTitle: 'Park ticket',
  intro: html`This parks the ticket until it can be worked on again, and
  notifies the submitter.`,
  fields: html`${textField('whyParked', 'Why is this being parked?')}
  ${textField('pathToResolution', 'What is the path to future resolution?')}
  ${textField(
    'intermediateActions',
    'What intermediate actions can be taken?'
  )}`,
  submitLabel: 'Park ticket',
});
