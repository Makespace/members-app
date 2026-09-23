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
  countFilteredConversations,
  getInboxThread,
  getInboxThreads,
  InboxMessage,
  InboxThread,
} from '../../read-models/external-state/gmail-inbox';
import {displayDate} from '../../templates/display-date';

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

// "Tara Beattie <beattietara@gmail.com>" is mostly noise in a narrow column,
// and an unbreakable address wide enough to push the table off the page. The
// name is what a manager scans for; the address is on the message itself.
const displayName = (sender: string) => {
  const named = /^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/.exec(sender);
  return named === null ? sender.trim() : named[1].trim();
};

const renderRow = (thread: InboxThread) => html`
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
    </td>
    <td>${sanitizeString(thread.latest.snippet ?? '')}</td>
  </tr>
`;

// Renders one row's sender cell, so the display-name handling can be tested
// without standing up a whole page.
export const mailboxListForTest = (senders: ReadonlyArray<string>): string =>
  `<table><tbody>${renderRow({
    filteredBy: undefined,
    conversationId: 'c1',
    gmailThreadId: 't1',
    messageCount: senders.length,
    senders,
    latest: {
      gmailMessageId: 'm1',
      gmailThreadId: 't1',
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
      attachments: [],
    },
  })}</tbody></table>`;

const renderList = (
  mailbox: string,
  filterToAddress: string,
  threads: ReadonlyArray<InboxThread>,
  filtered: {count: number; showing: boolean}
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
    ${filtered.showing
      ? html`<p>
          Showing everything, including the
          ${safe(String(filtered.count))} conversation${filtered.count === 1
            ? ''
            : safe('s')}
          the rules would hide, each labelled with the rule that matched.
          <a href="/mailbox">Hide them again</a>.
        </p>`
      : filtered.count > 0
        ? html`<p>
            ${safe(String(filtered.count))} conversation${filtered.count === 1
              ? ''
              : safe('s')}
            hidden as automated or bulk mail.
            <a href="/mailbox?filtered=1">Show them</a>.
          </p>`
        : html``}
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
              </tr>
            </thead>
            <tbody>
              ${joinHtml(threads.map(renderRow))}
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
          function fit(frame) {
            try {
              var doc = frame.contentDocument;
              if (!doc || !doc.body) return;
              frame.style.height = '0px';
              frame.style.height =
                Math.max(
                  doc.body.scrollHeight,
                  doc.documentElement.scrollHeight
                ) + 'px';
            } catch (e) {
              // Measuring failed; the stylesheet's height keeps it usable.
            }
          }
          function fitAll() {
            var frames = document.querySelectorAll('[data-email-frame]');
            Array.prototype.forEach.call(frames, fit);
          }
          var frames = document.querySelectorAll('[data-email-frame]');
          Array.prototype.forEach.call(frames, function (frame) {
            if (frame.contentDocument && frame.contentDocument.readyState === 'complete') {
              fit(frame);
            }
            frame.addEventListener('load', function () {
              fit(frame);
            });
          });
          // Images arriving, fonts settling and the window changing width all
          // change the height after first paint.
          window.addEventListener('resize', fitAll);
          window.addEventListener('load', fitAll);
          setTimeout(fitAll, 250);
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
                const [threads, filteredCount] = await Promise.all([
                  getInboxThreads(deps.extDB, INBOX_PAGE_SIZE, {
                    includeFiltered,
                  }),
                  countFilteredConversations(deps.extDB),
                ]);
                return {threads, filteredCount, includeFiltered};
              },
              cacheFailure(deps, 'the conversation list')
            ),
            TE.map(({threads, filteredCount, includeFiltered}) =>
              renderList(
                deps.conf.GMAIL_IMPORT_MAILBOX,
                deps.conf.GMAIL_FILTER_TO_ADDRESS,
                threads,
                {count: filteredCount, showing: includeFiltered}
              )
            )
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
