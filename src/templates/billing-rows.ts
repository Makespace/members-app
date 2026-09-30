import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {Html, html, joinHtml, sanitizeString} from '../types/html';
import {displayDate, displayDateShort} from './display-date';
import {
  renderCardOnFile,
  renderDaysOverdue,
  renderInvoiceIssues,
  renderInvoiceState,
  renderMoney,
} from './billing';
import {
  BillingInvoice,
  MemberBilling,
  PaymentAttempt,
} from '../read-models/external-state/recurly-billing';

// The pieces of an invoice listing, shared between the summary on a member's
// page and the full history on their billing page, so the two cannot come to
// different conclusions about the same invoice.

// Recurly is only copied every twenty minutes, and a copy that has stopped
// being refreshed would otherwise read as fact. Three days is the same bar the
// membership status uses.
const STALE_AFTER_DAYS = 3;

// Compact date in the cell, full timestamp on hover - as the areas page does.
export const renderBillingDate = (at: O.Option<Date>): Html =>
  pipe(
    at,
    O.match(
      () => html`-`,
      value => html`<span title="${displayDate(DateTime.fromJSDate(value))}"
        >${displayDateShort(DateTime.fromJSDate(value))}</span
      >`
    )
  );

export const renderStaleWarning = (
  billing: MemberBilling,
  now: Date
): Html =>
  pipe(
    billing.cachedAt,
    O.match(
      () => html``,
      cachedAt =>
        cachedAt.getTime() <
        now.getTime() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
          ? html`<p class="tag tag--yellow">
              This has not been refreshed from Recurly since
              ${displayDateShort(DateTime.fromJSDate(cachedAt))}, so it may be
              out of date.
            </p>`
          : html``
    )
  );

const attemptRow = (attempt: PaymentAttempt): Html => html`
  <tr>
    <td>${renderBillingDate(attempt.at)}</td>
    <td>
      ${attempt.succeeded
        ? html`Succeeded`
        : html`${sanitizeString(O.getOrElse(() => 'Failed')(attempt.status))}`}
    </td>
    <td>${sanitizeString(O.getOrElse(() => '-')(attempt.message))}</td>
    <td>${renderCardOnFile(attempt)}</td>
  </tr>
`;

// One attempt as a sentence, for a card. The table above is for the full
// history, where the columns line up and are worth scanning.
export const renderPaymentAttempt = (attempt: PaymentAttempt): Html => html`
  ${renderBillingDate(attempt.at)} &middot;
  ${attempt.succeeded
    ? html`succeeded`
    : html`${sanitizeString(O.getOrElse(() => 'failed')(attempt.status))}`}${pipe(
    attempt.message,
    O.match(
      () => html``,
      message => html` &middot; ${sanitizeString(message)}`
    )
  )}
  ${O.isSome(attempt.lastFour) || O.isSome(attempt.cardType)
    ? html`<br /><small>${renderCardOnFile(attempt)}</small>`
    : html``}
`;

const attemptsDetail = (invoice: BillingInvoice): Html =>
  invoice.attempts.length === 0
    ? html`<p>No payment has been attempted against this invoice.</p>`
    : html`
        <table>
          <tr>
            <th>When</th>
            <th>Outcome</th>
            <th>What the bank said</th>
            <th>Card used</th>
          </tr>
          ${joinHtml(invoice.attempts.map(attemptRow))}
        </table>
      `;

// 'automatic' and 'manual' are Recurly's words, and neither means much on its
// own to somebody deciding whether to chase a person.
export const renderHowItIsCollected = (method: O.Option<string>): Html =>
  pipe(
    method,
    O.match(
      () => html``,
      value => {
        switch (value) {
          case 'automatic':
            return html`Collected automatically from a card on file.`;
          case 'manual':
            return html`Not collected by card - this member pays some other
            way.`;
          default:
            return html`Collected by ${sanitizeString(value)}.`;
        }
      }
    )
  );

export const renderRemindersSent = (sent: number): Html =>
  sent === 0
    ? html`Recurly has not sent a reminder about it.`
    : sent === 1
      ? html`Recurly has sent 1 reminder.`
      : html`Recurly has sent ${sanitizeString(String(sent))} reminders.`;

// Only an unpaid invoice gets its reasons unfolded. A paid one is just a line
// in the history. `columns` is however wide the table it sits in happens to be.
export const renderWhyUnpaid = (
  invoice: BillingInvoice,
  columns: number
): Html =>
  !invoice.isOutstanding
    ? html``
    : html`
        <tr>
          <td colspan="${sanitizeString(String(columns))}">
            <details>
              <summary>
                Why this is unpaid ${renderInvoiceIssues(invoice.issues)}
              </summary>
              <p>
                ${renderHowItIsCollected(invoice.collectionMethod)}
                ${pipe(
                  invoice.dunningEventsSent,
                  O.match(
                    () => html``,
                    sent => html`${renderRemindersSent(sent)}`
                  )
                )}
              </p>
              ${attemptsDetail(invoice)}
            </details>
          </td>
        </tr>
      `;

// The full history: everything Recurly has raised, paid or not.
export const renderFullInvoiceRow = (invoice: BillingInvoice): Html => html`
  <tr>
    <td>${sanitizeString(O.getOrElse(() => '-')(invoice.number))}</td>
    <td>${renderBillingDate(invoice.createdAt)}</td>
    <td>${renderBillingDate(invoice.dueAt)}</td>
    <td>${renderMoney(invoice.total, invoice.currency)}</td>
    <td>${renderMoney(invoice.balance, invoice.currency)}</td>
    <td>${renderDaysOverdue(invoice.daysOverdue)}</td>
    <td>${renderInvoiceState(invoice.state)}</td>
  </tr>
`;

// The one line that answers "is this person square with us?".
export const renderBillingHeadline = (billing: MemberBilling): Html => html`
  ${billing.totalOutstanding > 0
    ? html`Outstanding:
        ${renderMoney(O.some(billing.totalOutstanding), billing.currency)}${pipe(
          billing.daysOverdue,
          O.match(
            () => html``,
            days =>
              html`, the oldest of it overdue by
              ${renderDaysOverdue(O.some(days))}`
          )
        )}.`
    : html`Nothing outstanding.`}
  ${pipe(
    billing.lastPaidAt,
    O.match(
      () => html`No successful payment on record.`,
      at => html`Last paid ${displayDateShort(DateTime.fromJSDate(at))}.`
    )
  )}
`;
