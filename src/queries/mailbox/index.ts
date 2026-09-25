import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {DateTime} from 'luxon';
import {Query} from '../query';
import {renderEmailHtml} from '../../templates/email-html';
import {
  splitQuotedHtml,
  splitQuotedText,
} from '../../templates/quoted-reply';
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
  countHiddenConversations,
  getInboxThread,
  getInboxThreads,
  InboxMessage,
  InboxThread,
} from '../../read-models/external-state/gmail-inbox';
import {displayDate} from '../../templates/display-date';
import {isManagementTeam} from '../../commands/authentication-helpers/is-management-team';

const INBOX_PAGE_SIZE = 50;

// The imported mailbox contains member correspondence (PII): only members of
// the management team's area - or super-users - may read it.
// Whatever went wrong reaching the cache, the member sees the same thing;
// without this the cause was discarded, so a broken query said only "failed
// to read the mailbox cache" in the logs too, which cost an afternoon.
const cacheFailure = (deps: Dependencies, what: string) => (error: unknown) => {
  deps.logger.error(
    {err: error instanceof Error ? error : new Error(String(error))},
    'Failed to read %s from the gmail cache',
    what
  );
  return failureWithStatus(
    'Failed to read the mailbox cache',
    StatusCodes.INTERNAL_SERVER_ERROR
  )();
};

// One check, shared with the archive commands, so who can see the mailbox
// and who can act on it never come apart.
const mustBeManagement =
  (deps: Dependencies) =>
  (user: User): TE.TaskEither<FailureWithStatus, void> =>
    isManagementTeam(
      deps.sharedReadModel,
      deps.conf.MANAGEMENT_TEAM_AREA_ID
    )({tag: 'user', user})
      ? TE.right(undefined)
      : TE.left(
          failureWithStatus(
            'Only the management team can see the mailbox',
            StatusCodes.FORBIDDEN
          )()
        );

// Gmail's own subjects carry the Re: chain; the thread's own subject reads
// better without it.
const threadSubject = (subject: string | null) =>
  (subject ?? '(no subject)').replace(/^((re|fwd|fw)\s*:\s*)+/i, '').trim() ||
  '(no subject)';

// "Alice Example <alice@example.com>" is mostly noise in a narrow column,
// and an unbreakable address wide enough to push the table off the page. The
// name is what a manager scans for; the address is on the message itself.
const displayName = (sender: string) => {
  const named = /^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/.exec(sender);
  return named === null ? sender.trim() : named[1].trim();
};

// One button per row, posting straight back to this page. Which button
// depends on where the conversation is; `returnTo` is the view the manager
// was looking at, so archiving from the archived view lands back there.
const actionCell = (thread: InboxThread, returnTo: string) => html`
  <td class="mailbox__actions">
    <form
      method="post"
      action="/mailbox/${safe(
        thread.archived ? 'unarchive' : 'archive'
      )}?next=${safe(encodeURIComponent(returnTo))}"
    >
      <input
        type="hidden"
        name="conversationId"
        value="${sanitizeString(thread.conversationId)}"
      />
      <button type="submit">
        ${safe(thread.archived ? 'Unarchive' : 'Archive')}
      </button>
    </form>
  </td>
`;

const renderRow = (thread: InboxThread, returnTo: string) => html`
  <tr>
    <td>${displayDate(DateTime.fromJSDate(thread.latest.receivedAt))}</td>
    <td>
      ${sanitizeString(
        thread.senders.length > 0
          ? [...new Set(thread.senders.map(displayName))].join(', ')
          : 'Unknown sender'
      )}
    </td>
    <td>
      <a href="/mailbox/${safe(encodeURIComponent(thread.conversationId))}"
        >${sanitizeString(threadSubject(thread.latest.subject))}</a
      >
      ${thread.messageCount > 1
        ? html`<span class="mailbox__count"
            >${safe(String(thread.messageCount))} messages</span
          >`
        : html``}
      ${thread.filteredBy === undefined
        ? html``
        : html`<span class="mailbox__filtered" title="Rule: ${safe(
            thread.filteredBy.id
          )}"
            >${sanitizeString(thread.filteredBy.reason)}</span
          >`}
      ${thread.archived
        ? html`<span class="mailbox__filtered">Archived</span>`
        : html``}
    </td>
    <td>
      <span class="mailbox-preview"
        >${sanitizeString(thread.latest.snippet ?? '')}</span
      >
    </td>
    ${actionCell(thread, returnTo)}
  </tr>
`;

// Renders one row's sender cell, so the display-name handling can be tested
// without standing up a whole page.
export const mailboxListForTest = (
  senders: ReadonlyArray<string>,
  archived = false
): string =>
  `<table><tbody>${renderRow(
    {
    filteredBy: undefined,
    archived,
    conversationId: 'c1',
    gmailThreadId: 't1',
    messageCount: senders.length,
    senders,
    latest: {
      gmailMessageId: 'm1',
      gmailThreadId: 't1',
      rfc822MessageId: '<m1@test>',
      fromAddress: senders[0] ?? null,
      toAddresses: null,
      subject: 'Subject',
      receivedAt: new Date('2026-09-23T09:42:00.000Z'),
      snippet: 'Preview',
      bodyText: null,
      bodyHtml: null,
      originalSender: null,
      replyTo: null,
      listUnsubscribe: null,
      autoSubmitted: null,
      precedence: null,
      headers: [],
      attachments: [],
    },
    },
    '/mailbox'
  )}</tbody></table>`;

const conversationCount = (count: number) =>
  html`${safe(String(count))} conversation${count === 1 ? '' : safe('s')}`;

// The filter describes itself even when it has hidden nothing. Left silent,
// a filter that is working and a filter that has been deleted look exactly
// alike on the page - and since this line carries the only link into the
// everything view, a quiet day also left no way to check what the rules
// would have done.
const filterNotice = (filtered: {count: number; showing: boolean}): Html => {
  if (filtered.count === 0) {
    // Both views are identical with nothing hidden, so neither link is
    // worth offering here.
    return html`<p>
      No conversations are hidden by the noise rules at the moment.
    </p>`;
  }
  if (filtered.showing) {
    return html`<p>
      Showing everything, including the ${conversationCount(filtered.count)}
      the rules would hide, each labelled with the rule that matched.
      <a href="/mailbox">Hide them again</a>.
    </p>`;
  }
  return html`<p>
    ${conversationCount(filtered.count)} hidden as automated or bulk mail.
    <a href="/mailbox?filtered=1">Show them</a>.
  </p>`;
};

// Renders the filter's own line, so its wording and links can be tested
// without standing up a whole page.
export const mailboxFilterNoticeForTest = (
  count: number,
  showing: boolean
): string => filterNotice({count, showing});

// The archive's line, in the same shape as the filter's: what is out of
// sight is always stated, and the link into it is always here.
const archivedNotice = (archived: {count: number; showing: boolean}): Html => {
  if (archived.count === 0) {
    return html`<p>No conversations are archived.</p>`;
  }
  if (archived.showing) {
    return html`<p>
      Showing the ${conversationCount(archived.count)} that
      ${archived.count === 1 ? safe('has') : safe('have')} been archived, marked as
      such. <a href="/mailbox">Hide them again</a>.
    </p>`;
  }
  return html`<p>
    ${conversationCount(archived.count)} archived.
    <a href="/mailbox?archived=1">Show them</a>.
  </p>`;
};

export const mailboxArchivedNoticeForTest = (
  count: number,
  showing: boolean
): string => archivedNotice({count, showing});

type Hidden = {
  filtered: {count: number; showing: boolean};
  archived: {count: number; showing: boolean};
};

const renderList = (
  mailbox: string,
  filterToAddress: string,
  threads: ReadonlyArray<InboxThread>,
  hidden: Hidden,
  returnTo: string
): Html => html`
  <div class="stack">
    <h1>Mailbox</h1>
    <p>
      The most recent ${threads.length}
      conversation${threads.length === 1 ? '' : safe('s')} sent to
      <strong>
        ${sanitizeString(filterToAddress !== '' ? filterToAddress : mailbox)}
      </strong>. The import runs every minute; replies and creating tickets
      from emails are coming next.
    </p>
    ${filterNotice(hidden.filtered)} ${archivedNotice(hidden.archived)}
    ${threads.length === 0
      ? html`<p>
          Nothing imported yet. If this persists, check the Gmail credentials
          and the sync worker logs.
        </p>`
      : html`
          <table class="mailbox-table">
            <thead>
              <tr>
                <th>Last reply</th>
                <th>Who</th>
                <th>Subject</th>
                <th>Preview</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${joinHtml(threads.map(thread => renderRow(thread, returnTo)))}
            </tbody>
          </table>
        `}
  </div>
`;

// How the body of one message is shown: its HTML when there is any, with
// remote images blocked unless asked for, otherwise the plain-text twin that
// almost every real email carries.
const asLines = (text: string) =>
  joinHtml(
    text.split('\n').map(line => html`${sanitizeString(line)}<br />`)
  );

// Folded away rather than thrown away: the history is one click from view.
const quotedHistory = (contents: Html) => html`
  <details class="email-quoted">
    <summary>Show quoted history</summary>
    ${contents}
  </details>
`;

const renderBody = (
  message: InboxMessage,
  options: {preferText: boolean; showImages: boolean}
): Html => {
  if (message.bodyHtml !== null && !options.preferText) {
    const {reply, quoted} = splitQuotedHtml(message.bodyHtml);
    return html`
      ${renderEmailHtml(reply, options.showImages)}
      ${quoted === ''
        ? html``
        : quotedHistory(renderEmailHtml(quoted, options.showImages))}
    `;
  }
  if (message.bodyText !== null) {
    const {reply, quoted} = splitQuotedText(message.bodyText);
    return html`
      <div class="email-body">${asLines(reply)}</div>
      ${quoted === ''
        ? html``
        : quotedHistory(html`<div class="email-body">${asLines(quoted)}</div>`)}
    `;
  }
  return html`<div class="email-body">
    <em>This message has no readable body.</em>
  </div>`;
};

const viewOption = (
  conversationId: string,
  label: string,
  query: string,
  active: boolean
) =>
  active
    ? html`<strong>${safe(label)}</strong>`
    : html`<a
        href="/mailbox/${safe(encodeURIComponent(conversationId))}${safe(
          query
        )}"
        >${safe(label)}</a
      >`;

const renderMessage = (
  message: InboxMessage,
  options: {preferText: boolean; showImages: boolean}
): Html => html`
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
    ${renderBody(message, options)}
  </article>
`;

// The whole conversation, oldest first, so it reads top to bottom.
const renderDetail = (
  messages: ReadonlyArray<InboxMessage>,
  options: {preferText: boolean; showImages: boolean}
): Html => {
  const conversationId = messages[0].gmailMessageId;
  const anyHtml = messages.some(message => message.bodyHtml !== null);
  return html`
    <div class="stack">
      <p><a href="/mailbox">← Back to the mailbox</a></p>
      <h1>${sanitizeString(threadSubject(messages[0].subject))}</h1>
      <p>
        ${safe(String(messages.length))}
        message${messages.length === 1 ? '' : safe('s')} in this conversation.
      </p>
      ${anyHtml
        ? html`<p class="mailbox__view-options">
            ${viewOption(
              conversationId,
              'Formatted',
              '',
              !options.preferText && !options.showImages
            )}
            ·
            ${viewOption(
              conversationId,
              'Show images',
              '?images=1',
              !options.preferText && options.showImages
            )}
            ·
            ${viewOption(conversationId, 'Plain text', '?text=1', options.preferText)}
            <small
              >Images in email are often tracking pixels, so they stay blocked
              until you ask for them.</small
            >
          </p>`
        : html``}
      ${joinHtml(messages.map(message => renderMessage(message, options)))}
      <script>
        (function () {
          // The frames hold inert markup - no scripts run inside them - so
          // the page measures them from outside and sizes each to its
          // content, rather than leaving a scrolling box in the flow.
          // A frame measured before its document exists reports zero, which
          // would collapse the message to nothing. Never shrink below a
          // readable minimum, and treat zero as "not ready yet".
          var MINIMUM = 32;
          function fit(frame) {
            try {
              var doc = frame.contentDocument;
              if (!doc || !doc.body) return false;
              var previous = frame.style.height;
              frame.style.height = '0px';
              var measured = Math.max(
                doc.body.scrollHeight,
                doc.documentElement.scrollHeight
              );
              if (measured <= 0) {
                frame.style.height = previous || MINIMUM + 'px';
                return false;
              }
              frame.style.height = Math.max(measured, MINIMUM) + 'px';
              return true;
            } catch (e) {
              return false;
            }
          }
          function fitAll() {
            var frames = document.querySelectorAll('[data-email-frame]');
            var allDone = true;
            Array.prototype.forEach.call(frames, function (frame) {
              if (!fit(frame)) allDone = false;
            });
            return allDone;
          }
          var frames = document.querySelectorAll('[data-email-frame]');
          Array.prototype.forEach.call(frames, function (frame) {
            frame.addEventListener('load', function () {
              fit(frame);
            });
          });
          // Keep trying briefly: srcdoc documents are not always ready when
          // the load event fires, and images change the height after it.
          var attempts = 0;
          var timer = setInterval(function () {
            attempts++;
            if (fitAll() || attempts > 20) clearInterval(timer);
          }, 150);
          window.addEventListener('resize', fitAll);
          window.addEventListener('load', fitAll);
          // Opening the quoted history reveals frames measured while hidden.
          document.addEventListener('toggle', fitAll, true);
        })();
      </script>
    </div>
  `;
};

export const mailbox: Query = deps => (user, params, queryParams) =>
  pipe(
    mustBeManagement(deps)(user),
    TE.chain(() =>
      params.id === undefined
        ? pipe(
            TE.tryCatch(
              async () => {
                const includeFiltered = queryParams.filtered === '1';
                const includeArchived = queryParams.archived === '1';
                const archivedMessageIds =
                  deps.sharedReadModel.mailbox.archivedMessageIds();
                const [threads, counts] = await Promise.all([
                  getInboxThreads(deps.extDB, INBOX_PAGE_SIZE, {
                    includeFiltered,
                    includeArchived,
                    archivedMessageIds,
                  }),
                  countHiddenConversations(deps.extDB, archivedMessageIds),
                ]);
                return {threads, counts, includeFiltered, includeArchived};
              },
              cacheFailure(deps, 'the conversation list')
            ),
            TE.map(({threads, counts, includeFiltered, includeArchived}) => {
              // Where a row's button sends the manager back to: the view
              // they were on, switches and all.
              const switches = [
                ...(includeFiltered ? ['filtered=1'] : []),
                ...(includeArchived ? ['archived=1'] : []),
              ];
              const returnTo =
                switches.length === 0
                  ? '/mailbox'
                  : `/mailbox?${switches.join('&')}`;
              return renderList(
                deps.conf.GMAIL_IMPORT_MAILBOX,
                deps.conf.GMAIL_FILTER_TO_ADDRESS,
                threads,
                {
                  filtered: {count: counts.filtered, showing: includeFiltered},
                  archived: {count: counts.archived, showing: includeArchived},
                },
                returnTo
              );
            })
          )
        : pipe(
            TE.tryCatch(
              () => getInboxThread(deps.extDB, params.id),
              cacheFailure(deps, 'a conversation')
            ),
            TE.filterOrElse(
              messages => messages.length > 0,
              () =>
                failureWithStatus(
                  'No such conversation',
                  StatusCodes.NOT_FOUND
                )()
            ),
            TE.map(messages =>
              renderDetail(messages, {
                preferText: queryParams.text === '1',
                showImages: queryParams.images === '1',
              })
            )
          )
    ),
    TE.map(toLoggedInContent(safe('Mailbox')))
  );
