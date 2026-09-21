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
  getInboxMessageById,
  getInboxMessages,
  InboxMessage,
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

const renderRow = (message: InboxMessage) => html`
  <tr>
    <td>${displayDate(DateTime.fromJSDate(message.receivedAt))}</td>
    <td>${sanitizeString(message.fromAddress ?? 'Unknown sender')}</td>
    <td>
      <a href="/mailbox/${safe(encodeURIComponent(message.gmailMessageId))}"
        >${sanitizeString(message.subject ?? '(no subject)')}</a
      >
    </td>
    <td>${sanitizeString(message.snippet ?? '')}</td>
  </tr>
`;

const renderList = (
  mailbox: string,
  filterToAddress: string,
  messages: ReadonlyArray<InboxMessage>
): Html => html`
  <div class="stack">
    <h1>Mailbox</h1>
    <p>
      The most recent ${messages.length} message${messages.length === 1
        ? ''
        : safe('s')}
      sent to
      <strong>
        ${sanitizeString(filterToAddress !== '' ? filterToAddress : mailbox)}
      </strong>. The import runs every few minutes; replies and creating
      tickets from emails are coming next.
    </p>
    ${messages.length === 0
      ? html`<p>
          Nothing imported yet. If this persists, check the Gmail credentials
          and the sync worker logs.
        </p>`
      : html`
          <table>
            <thead>
              <tr>
                <th>Received</th>
                <th>From</th>
                <th>Subject</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              ${joinHtml(messages.map(renderRow))}
            </tbody>
          </table>
        `}
  </div>
`;

const renderDetail = (message: InboxMessage): Html => html`
  <div class="stack">
    <p><a href="/mailbox">← Back to the mailbox</a></p>
    <h1>${sanitizeString(message.subject ?? '(no subject)')}</h1>
    <p>
      <strong>From:</strong>
      ${sanitizeString(message.fromAddress ?? 'Unknown sender')}<br />
      <strong>To:</strong> ${sanitizeString(message.toAddresses ?? '—')}<br />
      <strong>Received:</strong>
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
  </div>
`;

export const mailbox: Query = deps => (user, params) =>
  pipe(
    mustBeManagement(deps)(user),
    TE.chain(() =>
      params.id === undefined
        ? pipe(
            TE.tryCatch(
              () => getInboxMessages(deps.extDB, INBOX_PAGE_SIZE),
              () =>
                failureWithStatus(
                  'Failed to read the mailbox cache',
                  StatusCodes.INTERNAL_SERVER_ERROR
                )()
            ),
            TE.map(messages =>
              renderList(
                deps.conf.GMAIL_IMPORT_MAILBOX,
                deps.conf.GMAIL_FILTER_TO_ADDRESS,
                messages
              )
            )
          )
        : pipe(
            TE.tryCatch(
              () => getInboxMessageById(deps.extDB, params.id),
              () =>
                failureWithStatus(
                  'Failed to read the mailbox cache',
                  StatusCodes.INTERNAL_SERVER_ERROR
                )()
            ),
            TE.chain(
              TE.fromNullable(
                failureWithStatus('No such message', StatusCodes.NOT_FOUND)()
              )
            ),
            TE.map(renderDetail)
          )
    ),
    TE.map(toLoggedInContent(safe('Mailbox')))
  );
