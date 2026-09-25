import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {
  html,
  Html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';
import {getInboxThread} from '../../read-models/external-state/gmail-inbox';
import {splitQuotedText} from '../../templates/quoted-reply';
import {isManagementTeam} from '../authentication-helpers/is-management-team';

type ViewModel = {
  conversationId: string;
  // Filled in from the conversation, all editable.
  subject: string;
  sender: string;
  body: string;
  // What this conversation has already led to, so nobody raises it twice.
  existing: ReadonlyArray<{title: string; status: string}>;
};

const existingTickets = (viewModel: ViewModel): Html =>
  viewModel.existing.length === 0
    ? html``
    : html`
        <p>
          Already raised from this conversation:
          ${joinHtml(
            viewModel.existing.map(
              ticket => html`<strong>${sanitizeString(ticket.title)}</strong>
                (${sanitizeString(ticket.status)})`
            )
          )}
        </p>
      `;

const renderForm: Form<ViewModel>['renderForm'] = viewModel =>
  pipe(
    html`
      <div class="stack tt-form">
        <h1>Create a ticket from this email</h1>
        <p>
          The ticket goes on the management team's board. The sender is
          recorded as who raised it, but is not emailed - any reply belongs in
          the conversation.
        </p>
        ${existingTickets(viewModel)}
        <form
          action="/mailbox/create-ticket?next=${safe(
            encodeURIComponent(`/mailbox/${viewModel.conversationId}`)
          )}"
          method="post"
          class="stack"
        >
          <input
            type="hidden"
            name="conversationId"
            value="${sanitizeString(viewModel.conversationId)}"
          />
          <p><strong>From:</strong> ${sanitizeString(viewModel.sender)}</p>
          <label class="stack">
            <strong>Title</strong>
            <input
              type="text"
              name="title"
              value="${sanitizeString(viewModel.subject)}"
              required
            />
          </label>
          <label class="stack">
            <strong>What's the problem?</strong>
            <small class="tt-form__hint"
              >The email, ready to trim to what matters.</small
            >
            <textarea name="issue" rows="12" required>
${sanitizeString(viewModel.body)}</textarea
            >
          </label>
          <label class="stack">
            <strong>Anything already tried?</strong>
            <small class="tt-form__hint">Optional.</small>
            <textarea name="steps" rows="3"></textarea>
          </label>
          <button type="submit">Create ticket</button>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Create a ticket from this email'))
  );

// The subject, without the reply and list prefixes it collected on the way.
const cleanSubject = (subject: string | null): string =>
  (subject ?? '')
    .replace(/^(\s*(re|fwd|fw)\s*:|\s*\[[^\]]*\])+/gi, '')
    .trim();

// The page shows the email, which is member correspondence, so it checks
// who is asking the same way the mailbox does - here, where the
// configuration is to hand.
const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user, deps, readModel}) =>
    pipe(
      input,
      t.type({conversationId: t.string}).decode,
      E.mapLeft(formatValidationErrors),
      E.mapLeft(
        failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)
      ),
      TE.fromEither,
      TE.filterOrElse(
        () =>
          isManagementTeam(readModel, deps.conf.MANAGEMENT_TEAM_AREA_ID)({
            tag: 'user',
            user,
          }),
        () =>
          failureWithStatus(
            'Only the management team can create tickets from the mailbox',
            StatusCodes.FORBIDDEN
          )()
      ),
      TE.chain(({conversationId}) =>
        TE.tryCatch(
          () => getInboxThread(deps.extDB, conversationId),
          () =>
            failureWithStatus(
              'Failed to read the mailbox cache',
              StatusCodes.INTERNAL_SERVER_ERROR
            )()
        )
      ),
      TE.filterOrElse(
        messages => messages.length > 0,
        () => failureWithStatus('No such conversation', StatusCodes.NOT_FOUND)()
      ),
      TE.map(messages => {
        const first = messages[0];
        return {
          conversationId: first.gmailMessageId,
          subject: cleanSubject(first.subject),
          sender: first.fromAddress ?? 'Unknown sender',
          body: splitQuotedText(first.bodyText ?? '').reply,
          existing: readModel.troubleTickets
            .getByMailboxConversation(first.gmailMessageId)
            .map(ticket => ({title: ticket.title, status: ticket.status})),
        };
      })
    );

export const createTicketForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
