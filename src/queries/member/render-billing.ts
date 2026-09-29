import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {Html, html, joinHtml, sanitizeString} from '../../types/html';
import {displayDate, displayDateShort} from '../../templates/display-date';
import {
  renderCardOnFile,
  renderDaysOverdue,
  renderInvoiceIssues,
  renderInvoiceState,
  renderMoney,
} from '../../templates/billing';
import {
  BillingInvoice,
  MemberBilling,
  PaymentAttempt,
} from '../../read-models/external-state/recurly-billing';
import {ViewModel} from './view-model';

// Recurly is only copied every twenty minutes, and a copy that has stopped
// being refreshed would otherwise read as fact. Three days is the same bar the
// membership status uses.
const STALE_AFTER_DAYS = 3;

const renderDate = (at: O.Option<Date>): Html =>
  pipe(
    at,
    O.match(
      () => html`-`,
      value => html`<span title="${displayDate(DateTime.fromJSDate(value))}"
        >${displayDateShort(DateTime.fromJSDate(value))}</span
      >`
    )
  );

const staleWarning = (billing: MemberBilling, now: Date): Html =>
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

// The latest attempt is the one that explains the current state; the rest are
// history, and only worth unfolding when somebody is actually investigating.
const attemptRow = (attempt: PaymentAttempt): Html => html`
  <tr>
    <td>${renderDate(attempt.at)}</td>
    <td>
      ${attempt.succeeded
        ? html`Succeeded`
        : html`${sanitizeString(
            O.getOrElse(() => 'Failed')(attempt.status)
          )}`}
    </td>
    <td>${sanitizeString(O.getOrElse(() => '-')(attempt.message))}</td>
    <td>${renderCardOnFile(attempt)}</td>
  </tr>
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
const howItIsCollected = (method: O.Option<string>): Html =>
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

const remindersSent = (sent: number): Html =>
  sent === 0
    ? html`Recurly has not sent a reminder about it.`
    : sent === 1
      ? html`Recurly has sent 1 reminder.`
      : html`Recurly has sent ${sanitizeString(String(sent))} reminders.`;

// Only an unpaid invoice gets its reasons unfolded. A paid one is just a line
// in the history.
const whyUnpaid = (invoice: BillingInvoice): Html =>
  !invoice.isOutstanding
    ? html``
    : html`
        <tr>
          <td colspan="7">
            <details>
              <summary>
                Why this is unpaid ${renderInvoiceIssues(invoice.issues)}
              </summary>
              <p>
                ${howItIsCollected(invoice.collectionMethod)}
                ${pipe(
                  invoice.dunningEventsSent,
                  O.match(
                    () => html``,
                    sent => html`${remindersSent(sent)}`
                  )
                )}
              </p>
              ${attemptsDetail(invoice)}
            </details>
          </td>
        </tr>
      `;

const invoiceRow = (invoice: BillingInvoice): Html => html`
  <tr>
    <td>${sanitizeString(O.getOrElse(() => '-')(invoice.number))}</td>
    <td>${renderDate(invoice.createdAt)}</td>
    <td>${renderDate(invoice.dueAt)}</td>
    <td>${renderMoney(invoice.total, invoice.currency)}</td>
    <td>${renderMoney(invoice.balance, invoice.currency)}</td>
    <td>${renderDaysOverdue(invoice.daysOverdue)}</td>
    <td>${renderInvoiceState(invoice.state)}</td>
  </tr>
`;

const summary = (billing: MemberBilling): Html => html`
  <p>
    ${billing.totalOutstanding > 0
      ? html`Outstanding:
          ${renderMoney(
            O.some(billing.totalOutstanding),
            billing.currency
          )}${pipe(
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
  </p>
`;

// Super users only - see the view model, which does not fetch any of this for
// anybody else.
export const renderBilling = (
  viewModel: ViewModel,
  now: Date = new Date()
): Html =>
  pipe(
    viewModel.billing,
    O.match(
      () => html``,
      billing =>
        billing.invoices.length === 0
          ? html`
              <table>
                <caption>
                  Billing
                </caption>
                <tbody>
                  <tr>
                    <td>
                      No Recurly invoices are held against this member's
                      verified addresses.
                    </td>
                  </tr>
                </tbody>
              </table>
            `
          : html`
              <table>
                <caption>
                  Billing
                </caption>
                <tr>
                  <th>Invoice</th>
                  <th>Raised</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Outstanding</th>
                  <th>Overdue by</th>
                  <th>State</th>
                </tr>
                ${joinHtml(
                  billing.invoices.map(
                    invoice => html`
                      ${invoiceRow(invoice)}${whyUnpaid(invoice)}
                    `
                  )
                )}
              </table>
              ${summary(billing)} ${staleWarning(billing, now)}
            `
    )
  );
