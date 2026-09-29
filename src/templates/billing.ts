import * as O from 'fp-ts/Option';
import {Html, html, joinHtml, sanitizeString} from '../types/html';
import {InvoiceIssue} from '../read-models/external-state/recurly-billing';
import {tag} from './member-status';

// Shared so that the member page and any summary of outstanding invoices can
// never come to different conclusions about why somebody has not paid.

const SYMBOLS: Record<string, string> = {
  GBP: '£',
  EUR: '€',
  USD: '$',
};

// Amounts are stored exactly as Recurly reports them - a decimal, not minor
// units - so rounding happens here, at the point of display, and only here.
export const renderMoney = (
  amount: O.Option<number>,
  currency: O.Option<string>
): Html => {
  if (O.isNone(amount)) {
    return html`-`;
  }
  const code = O.getOrElse(() => 'GBP')(currency);
  const symbol = SYMBOLS[code];
  const value = amount.value.toFixed(2);
  return symbol === undefined
    ? html`${sanitizeString(`${value} ${code}`)}`
    : html`${sanitizeString(`${symbol}${value}`)}`;
};

// The state Recurly gives an invoice, said plainly. Only 'past_due' and
// 'failed' are alarming; the rest are ordinary bookkeeping.
export const renderInvoiceState = (state: string): Html => {
  switch (state) {
    case 'paid':
      return tag(html`Paid`, 'green');
    case 'past_due':
      return tag(html`Overdue`, 'red');
    case 'failed':
      return tag(html`Failed`, 'red');
    case 'open':
      return tag(html`Open`, 'yellow');
    case 'pending':
    case 'processing':
      return tag(html`In progress`, 'yellow');
    case 'voided':
      return tag(html`Voided`, 'grey');
    case 'closed':
      return tag(html`Closed`, 'grey');
    default:
      return tag(html`${sanitizeString(state)}`, 'grey');
  }
};

// Exhaustive on purpose: a new issue without a chip here is a compile error.
const issueChip = (issue: InvoiceIssue): Html => {
  switch (issue) {
    case 'expired-card':
      return tag(html`Card expired`, 'red');
    case 'declined':
      return tag(html`Payment declined`, 'red');
    case 'no-attempt':
      return tag(html`Not attempted`, 'yellow');
    case 'manual-unpaid':
      return tag(html`Not paid by card`, 'yellow');
    case 'partly-paid':
      return tag(html`Part paid`, 'yellow');
    case 'dunning-exhausted':
      return tag(html`Chasing stopped`, 'grey');
  }
};

export const renderInvoiceIssues = (
  issues: ReadonlyArray<InvoiceIssue>
): Html =>
  issues.length === 0
    ? html``
    : joinHtml(issues.map(issue => html`${issueChip(issue)} `));

// "14 days" reads better than a date when the point is how long it has been.
export const renderDaysOverdue = (days: O.Option<number>): Html => {
  if (O.isNone(days)) {
    return html`-`;
  }
  return days.value === 1
    ? html`1 day`
    : html`${sanitizeString(String(days.value))} days`;
};

export const renderCardOnFile = (card: {
  cardType: O.Option<string>;
  lastFour: O.Option<string>;
  expMonth: O.Option<number>;
  expYear: O.Option<number>;
}): Html => {
  if (O.isNone(card.lastFour) && O.isNone(card.cardType)) {
    return html`-`;
  }
  const type = O.getOrElse(() => 'Card')(card.cardType);
  const lastFour = O.isSome(card.lastFour)
    ? ` ending ${card.lastFour.value}`
    : '';
  const expiry =
    O.isSome(card.expMonth) && O.isSome(card.expYear)
      ? `, expires ${String(card.expMonth.value).padStart(2, '0')}/${
          card.expYear.value
        }`
      : '';
  return html`${sanitizeString(`${type}${lastFour}${expiry}`)}`;
};
