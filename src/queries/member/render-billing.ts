import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Html, html, joinHtml, safe, sanitizeString} from '../../types/html';
import {
  renderBillingDate,
  renderBillingHeadline,
  renderHowItIsCollected,
  renderPaymentAttempt,
  renderRemindersSent,
  renderStaleWarning,
} from '../../templates/billing-rows';
import {
  renderDaysOverdue,
  renderInvoiceIssues,
  renderInvoiceState,
  renderMoney,
} from '../../templates/billing';
import {
  BillingInvoice,
  invoicesSinceFirstUnpaid,
} from '../../read-models/external-state/recurly-billing';
import {ViewModel} from './view-model';

const fullHistoryLink = (memberNumber: number): Html =>
  html`<a href="/member/${safe(String(memberNumber))}/billing"
    >All invoices</a
  >`;

// Follows the trouble-ticket cards: a coloured left edge for the state, so a
// run of them can be read down the page without reading any of the words.
const cardModifier = (invoice: BillingInvoice): string => {
  if (!invoice.isOutstanding) {
    return 'paid';
  }
  return O.isSome(invoice.daysOverdue) ? 'overdue' : 'open';
};

// When the money actually arrived, which is the interesting date on one of
// these; falling back to when it was raised if no attempt is recorded.
const settledOn = (invoice: BillingInvoice): O.Option<Date> => {
  const paid = invoice.attempts.find(attempt => attempt.succeeded);
  return paid !== undefined && O.isSome(paid.at) ? paid.at : invoice.createdAt;
};

// A settled invoice is one line: it is here to show the rhythm of payment
// around the ones that failed, not to be studied.
const settledCard = (invoice: BillingInvoice): Html => html`
  <article class="billing-card billing-card--paid">
    <div class="billing-card__header">
      <h3>${sanitizeString(O.getOrElse(() => 'Invoice')(invoice.number))}</h3>
      ${renderInvoiceState(invoice.state)}
    </div>
    <p class="billing-card__facts">
      ${renderMoney(invoice.total, invoice.currency)} &middot; paid
      ${renderBillingDate(settledOn(invoice))}
    </p>
  </article>
`;

const latestAttempt = (invoice: BillingInvoice): Html =>
  invoice.attempts.length === 0
    ? html``
    : html`<p class="billing-card__attempt">
        ${renderPaymentAttempt(invoice.attempts[0])}
      </p>`;

const earlierAttempts = (invoice: BillingInvoice): Html =>
  invoice.attempts.length < 2
    ? html``
    : html`
        <details>
          <summary>
            ${sanitizeString(String(invoice.attempts.length - 1))} earlier
            attempt${invoice.attempts.length === 2 ? html`` : html`s`}
          </summary>
          ${joinHtml(
            invoice.attempts
              .slice(1)
              .map(
                attempt =>
                  html`<p class="billing-card__attempt">
                    ${renderPaymentAttempt(attempt)}
                  </p>`
              )
          )}
        </details>
      `;

const unpaidCard = (invoice: BillingInvoice): Html => html`
  <article class="billing-card billing-card--${safe(cardModifier(invoice))}">
    <div class="billing-card__header">
      <h3>${sanitizeString(O.getOrElse(() => 'Invoice')(invoice.number))}</h3>
      ${renderInvoiceState(invoice.state)} ${renderInvoiceIssues(invoice.issues)}
    </div>
    <p class="billing-card__facts">
      ${renderMoney(invoice.balance, invoice.currency)} outstanding &middot; due
      ${renderBillingDate(invoice.dueAt)}${pipe(
        invoice.daysOverdue,
        O.match(
          () => html``,
          days =>
            html` &middot; overdue by ${renderDaysOverdue(O.some(days))}`
        )
      )}
    </p>
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
    ${latestAttempt(invoice)} ${earlierAttempts(invoice)}
  </article>
`;

const card = (invoice: BillingInvoice): Html =>
  invoice.isOutstanding ? unpaidCard(invoice) : settledCard(invoice);

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
      billing => {
        if (billing.invoices.length === 0) {
          return html`
            <h2>Billing</h2>
            <p>
              No Recurly invoices are held against this member's verified
              addresses.
            </p>
          `;
        }
        const worthShowing = invoicesSinceFirstUnpaid(billing.invoices);
        return html`
          <h2>Billing</h2>
          <p>
            ${renderBillingHeadline(billing)}
            ${fullHistoryLink(viewModel.member.memberNumber)}
          </p>
          ${worthShowing.length === 0
            ? html``
            : html`<div class="billing-cards">
                ${joinHtml(worthShowing.map(card))}
              </div>`}
          ${renderStaleWarning(billing, now)}
        `;
      }
    )
  );
