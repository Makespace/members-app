import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
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
import {isTicketOwner} from './authorization';
import {
  describeTicketChange,
  TicketChange,
  ticketNotificationRecipients,
  ticketNotificationSubject,
  ticketNotificationText,
} from '../../trouble-tickets/notification';

// A trouble-ticket action confirmation page. Shows the ticket, what the
// action does, exactly who will be emailed and what the email will say, any
// required text fields, then a submit button that POSTs to the matching
// command. The command's own isAuthorized/decode enforce permission and
// required input; this is the confirm + capture step.
type ActionViewModel = {
  ticketId: UUID;
  title: string;
  // What submitting will send, worked out before it happens from the same
  // code that sends it.
  email: {
    recipients: ReadonlyArray<string>;
    subject: string;
    text: string;
  };
};

type ActionConfig = {
  verb: string;
  pageTitle: string;
  intro: Html;
  fields?: Html;
  submitLabel: string;
  // The change as the email will describe it, with placeholders where the
  // answers typed below will go.
  change: TicketChange;
  // Whether the page offers to send nothing at all.
  canBeQuiet?: boolean;
};

// A required multi-line text field.
const textField = (name: string, label: string) => html`
  <label class="stack">
    <strong>${safe(label)}</strong>
    <textarea name="${safe(name)}" rows="3" required></textarea>
  </label>
`;

const optionalTextField = (name: string, label: string) => html`
  <label class="stack">
    <strong>${safe(label)}</strong>
    <textarea name="${safe(name)}" rows="3"></textarea>
  </label>
`;

// Says, before anything is sent, who will get an email and what it will
// say - the recipients and the words come from the notifier itself, so
// this cannot drift from what goes out.
const emailNotice = (
  email: ActionViewModel['email'],
  canBeQuiet: boolean
): Html => html`
  <aside class="tt-email-notice stack" id="tt-email-notice">
    ${email.recipients.length === 0
      ? html`<p>
          <strong>No email will be sent.</strong> Nobody has a usable address
          for this ticket.
        </p>`
      : html`
          <p>
            <strong
              >An email will be sent to
              ${sanitizeString(email.recipients.join(', '))}</strong
            >
            when you submit. It will say:
          </p>
          <p><strong>Subject:</strong> ${sanitizeString(email.subject)}</p>
          <pre class="tt-email-preview">${sanitizeString(email.text)}</pre>
        `}
  </aside>
  ${canBeQuiet
    ? html`<p class="tt-email-notice" id="tt-email-none" hidden>
        <strong>No email will be sent</strong> - you have chosen not to email
        the submitter.
      </p>`
    : html``}
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
          ${emailNotice(viewModel.email, config.canBeQuiet === true)}
          <form
            action="/trouble-tickets/${safe(config.verb)}?next=/trouble-tickets/board"
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
              <a href="/trouble-tickets/board">Cancel</a>
            </div>
          </form>
        </div>
      `,
      toLoggedInContent(safe(config.pageTitle))
    );

  const constructForm: Form<ActionViewModel>['constructForm'] =
    input =>
    ({user, deps, readModel}) =>
      pipe(
        input,
        t.type({ticketId: UUID}).decode,
        E.mapLeft(formatValidationErrors),
        E.mapLeft(
          failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)
        ),
        // The ticket title below is submitter-provided content, so the page is
        // gated like the action itself: owners of the ticket's equipment's
        // area (or admins). Checked before the existence lookup so an
        // unauthorized viewer cannot probe which ticket ids exist.
        E.filterOrElse(
          ({ticketId}) =>
            isTicketOwner({
              actor: {tag: 'user', user},
              rm: readModel,
              input: {ticketId},
            }),
          () =>
            failureWithStatus(
              "Only owners of the ticket's equipment's area (or admins) can act on it",
              StatusCodes.FORBIDDEN
            )()
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
            E.map(ticket => {
              // The email names whoever acts, as the notifier will.
              const actor = pipe(
                readModel.members.getByMemberNumber(user.memberNumber),
                O.chain(member => member.name),
                O.getOrElse(() => `Member ${user.memberNumber}`)
              );
              return {
                ticketId,
                title: ticket.title,
                email: {
                  recipients: ticketNotificationRecipients(
                    readModel,
                    ticket,
                    config.change.type
                  ),
                  subject: ticketNotificationSubject(ticket.title, false),
                  text: ticketNotificationText(
                    deps.conf.PUBLIC_URL,
                    ticket.title,
                    describeTicketChange(config.change, actor),
                    false
                  ),
                },
              };
            })
          )
        ),
        TE.fromEither
      );

  return {renderForm, constructForm, formIsAuthorized: null};
};

// Stands in, on the page, for what will be typed below.
const YOUR_ANSWER = '(what you write below)';

export const assignForm = troubleTicketActionForm({
  verb: 'assign',
  pageTitle: 'Assign this ticket to you',
  intro: html`This assigns the ticket to you and emails the submitter. If it
  isn't already In Progress, it will be moved there.`,
  change: {type: 'TroubleTicketAssigned', comment: YOUR_ANSWER},
  fields: optionalTextField(
    'comment',
    'Add a comment for the submitter (optional)'
  ),
  submitLabel: 'Assign to me',
});

export const resolveForm = troubleTicketActionForm({
  verb: 'resolve',
  pageTitle: 'Resolve ticket',
  intro: html`This marks the ticket as Resolved, unassigns everyone, and
  emails the submitter - unless you choose not to.`,
  change: {type: 'TroubleTicketResolved', summary: YOUR_ANSWER},
  canBeQuiet: true,
  // The summary is required only when the submitter will be emailed: a quiet
  // resolve is backlog clearing, where there is nothing to tell them. The
  // command enforces this; the script below keeps the browser's own
  // validation in step, and swaps the notice above to say that nothing will
  // be sent. The form still works without it.
  fields: html`
    <label class="stack">
      <strong>What did you do to resolve this ticket?</strong>
      <textarea
        name="summary"
        id="resolve-summary"
        rows="3"
        required
      ></textarea>
    </label>
    <label class="checkbox-row">
      <input type="checkbox" name="quiet" id="resolve-quiet" />
      <span
        >Don't email the submitter (for clearing out tickets that were already
        resolved outside the app)</span
      >
    </label>
    <script>
      (function () {
        var quiet = document.getElementById('resolve-quiet');
        var summary = document.getElementById('resolve-summary');
        var notice = document.getElementById('tt-email-notice');
        var none = document.getElementById('tt-email-none');
        if (!quiet || !summary) return;
        var sync = function () {
          summary.required = !quiet.checked;
          if (notice) notice.hidden = quiet.checked;
          if (none) none.hidden = !quiet.checked;
        };
        quiet.addEventListener('change', sync);
        sync();
      })();
    </script>
  `,
  submitLabel: 'Resolve ticket',
});

export const needsHelpForm = troubleTicketActionForm({
  verb: 'needs-help',
  pageTitle: 'Flag as Needs Help',
  intro: html`This flags the ticket as Needs Help and unassigns you, then
  emails the submitter and the machine's trainers so someone else can pick it
  up.`,
  change: {
    type: 'TroubleTicketNeedsHelp',
    whatTried: YOUR_ANSWER,
    whyDidntWork: YOUR_ANSWER,
  },
  fields: html`${textField('whatTried', 'What did you try?')}
  ${textField('whyDidntWork', "Why didn't it work?")}`,
  submitLabel: 'Flag Needs Help',
});

export const parkForm = troubleTicketActionForm({
  verb: 'park',
  pageTitle: 'Park ticket',
  intro: html`This parks the ticket until it can be worked on again, and
  emails the submitter.`,
  change: {
    type: 'TroubleTicketParked',
    whyParked: YOUR_ANSWER,
    pathToResolution: YOUR_ANSWER,
    intermediateActions: YOUR_ANSWER,
  },
  fields: html`${textField('whyParked', 'Why is this being parked?')}
  ${textField('pathToResolution', 'What is the path to future resolution?')}
  ${textField(
    'intermediateActions',
    'What intermediate actions can be taken?'
  )}`,
  submitLabel: 'Park ticket',
});
