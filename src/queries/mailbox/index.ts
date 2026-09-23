import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {DateTime} from 'luxon';
import {Query} from '../query';
import {Dependencies} from '../../dependencies';
import {User} from '../../types';
import {
  html,
  Html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {
  getInboxThread,
  getInboxThreads,
  InboxMessage,
  InboxThread,
} from '../../read-models/external-state/gmail-inbox';
import {displayDate} from '../../templates/display-date';

const INBOX_PAGE_SIZE = 50;

// The imported mailbox contains member correspondence (PII): only members of
// the management team's area - or super-users - may read it.
const mustBeManagement =
  (deps: Dependencies) =>
  (user: User): TE.TaskEither<FailureWithStatus, void> =>
    pipe(
      deps.sharedReadModel.members.getByMemberNumber(user.memberNumber),
      TE.fromOption(
        failureWithStatus(
          'Only the management team can see the mailbox',
          StatusCodes.UNAUTHORIZED
        )
      ),
      TE.filterOrElse(
        member =>
          member.isSuperUser ||
          (deps.conf.MANAGEMENT_TEAM_AREA_ID !== '' &&
            member.ownerOf.some(
              area => area.id === deps.conf.MANAGEMENT_TEAM_AREA_ID
            )),
        () =>
          failureWithStatus(
            'Only the management team can see the mailbox',
            StatusCodes.FORBIDDEN
          )()
      ),
      TE.map(() => undefined)
    );

// Gmail's own subjects carry the Re: chain; the thread's own subject reads
// better without it.
const threadSubject = (subject: string | null) =>
  (subject ?? '(no subject)').replace(/^((re|fwd|fw)\s*:\s*)+/i, '').trim() ||
  '(no subject)';

const renderRow = (thread: InboxThread) => html`
  <tr>
    <td>${displayDate(DateTime.fromJSDate(thread.latest.receivedAt))}</td>
    <td>
      ${sanitizeString(
        thread.senders.length > 0
          ? thread.senders.join(', ')
          : 'Unknown sender'
      )}
    </td>
    <td>
      <a href="/mailbox/${safe(encodeURIComponent(thread.gmailThreadId))}"
        >${sanitizeString(threadSubject(thread.latest.subject))}</a
      >
      ${thread.messageCount > 1
        ? html`<span class="mailbox__count"
            >${safe(String(thread.messageCount))} messages</span
          >`
        : html``}
    </td>
    <td>${sanitizeString(thread.latest.snippet ?? '')}</td>
  </tr>
`;

const renderList = (
  mailbox: string,
  filterToAddress: string,
  threads: ReadonlyArray<InboxThread>
): Html => html`
  <div class="stack">
    <h1>Mailbox</h1>
    <p>
      The most recent ${threads.length}
      conversation${threads.length === 1 ? '' : safe('s')} sent to
      <strong>
        ${sanitizeString(filterToAddress !== '' ? filterToAddress : mailbox)}
      </strong>. The import runs every few minutes; replies and creating
      tickets from emails are coming next.
    </p>
    ${threads.length === 0
      ? html`<p>
          Nothing imported yet. If this persists, check the Gmail credentials
          and the sync worker logs.
        </p>`
      : html`
          <table>
            <thead>
              <tr>
                <th>Last reply</th>
                <th>Who</th>
                <th>Subject</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              ${joinHtml(threads.map(renderRow))}
            </tbody>
          </table>
        `}
  </div>
`;

const renderMessage = (message: InboxMessage): Html => html`
  <article class="mailbox__message stack">
    <p class="mailbox__meta">
      <strong>${sanitizeString(message.fromAddress ?? 'Unknown sender')}</strong
      ><br />
      <strong>To:</strong> ${sanitizeString(message.toAddresses ?? '—')}<br />
      ${displayDate(DateTime.fromJSDate(message.receivedAt))}
    </p>
    ${message.attachments.length > 0
      ? html`<p>
          <strong>Attachments (not imported):</strong>
          ${sanitizeString(
            message.attachments
              .map(attachment => attachment.filename)
              .join(', ')
          )}
        </p>`
      : ''}
    <div class="email-body">
      ${message.bodyText
        ? joinHtml(
            message.bodyText
              .split('\n')
              .map(line => html`${sanitizeString(line)}<br />`)
          )
        : html`<em
            >No plain-text body. (Rich HTML rendering is deliberately not done
            - the text part covers almost all real email.)</em
          >`}
    </div>
  </article>
`;

// The whole conversation, oldest first, so it reads top to bottom.
const renderDetail = (messages: ReadonlyArray<InboxMessage>): Html => html`
  <div class="stack">
    <p><a href="/mailbox">← Back to the mailbox</a></p>
    <h1>${sanitizeString(threadSubject(messages[0].subject))}</h1>
    <p>
      ${safe(String(messages.length))}
      message${messages.length === 1 ? '' : safe('s')} in this conversation.
    </p>
    ${joinHtml(messages.map(renderMessage))}
  </div>
`;

export const mailbox: Query = deps => (user, params) =>
  pipe(
    mustBeManagement(deps)(user),
    TE.chain(() =>
      params.id === undefined
        ? pipe(
            TE.tryCatch(
              () => getInboxThreads(deps.extDB, INBOX_PAGE_SIZE),
              () =>
                failureWithStatus(
                  'Failed to read the mailbox cache',
                  StatusCodes.INTERNAL_SERVER_ERROR
                )()
            ),
            TE.map(threads =>
              renderList(
                deps.conf.GMAIL_IMPORT_MAILBOX,
                deps.conf.GMAIL_FILTER_TO_ADDRESS,
                threads
              )
            )
          )
        : pipe(
            TE.tryCatch(
              () => getInboxThread(deps.extDB, params.id),
              () =>
                failureWithStatus(
                  'Failed to read the mailbox cache',
                  StatusCodes.INTERNAL_SERVER_ERROR
                )()
            ),
            TE.filterOrElse(
              messages => messages.length > 0,
              () =>
                failureWithStatus(
                  'No such conversation',
                  StatusCodes.NOT_FOUND
                )()
            ),
            TE.map(renderDetail)
          )
    ),
    TE.map(toLoggedInContent(safe('Mailbox')))
  );
