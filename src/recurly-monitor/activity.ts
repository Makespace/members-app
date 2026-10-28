import mjml2html from 'mjml';
import {DateTime} from 'luxon';
import {Email} from '../types';

// Watching Recurly for the signature of a card-testing attack, and summarising
// its week for the management team.
//
// A "blocked" payment is one Recurly records with a fraud_* decline code -
// 'fraud_gateway' is Stripe refusing it, 'fraud_address' a failed address
// check. Ordinary declines (insufficient funds, expired card) are "failed".
// In normal traffic blocked payments are rare: January to May 2026 saw 7 in
// total and never more than 2 in a day. The 2026 card-testing attack, which
// ran bots through stolen cards on the hosted signup page from June to
// October, reached 246 in a day.

type TransactionRow = {
  type: string | null;
  status: string | null;
  statusCode: string | null;
  origin: string | null;
  ipAddressCountry: string | null;
  amount: number | null;
};

const isBlocked = (row: Pick<TransactionRow, 'statusCode'>): boolean =>
  row.statusCode?.startsWith('fraud_') ?? false;

type TransactionCounts = {
  successfulPayments: number;
  successfulAmount: number;
  failedPayments: number;
  blockedPayments: number;
  // Of the blocked payments, how many came through the hosted signup page
  // rather than a member's renewal - an attack shows up here.
  blockedSignups: number;
  // Where the blocked attempts came from, most first.
  blockedCountries: ReadonlyArray<{country: string; count: number}>;
  refunds: number;
  refundedAmount: number;
};

export const countTransactions = (
  rows: ReadonlyArray<TransactionRow>
): TransactionCounts => {
  const purchases = rows.filter(row => row.type === 'purchase');
  const successful = purchases.filter(row => row.status === 'success');
  const blocked = purchases.filter(isBlocked);
  const refunds = rows.filter(
    row => row.type === 'refund' && row.status === 'success'
  );
  const byCountry = new Map<string, number>();
  for (const row of blocked) {
    const country = row.ipAddressCountry || 'unknown';
    byCountry.set(country, (byCountry.get(country) ?? 0) + 1);
  }
  const sum = (some: ReadonlyArray<TransactionRow>) =>
    Math.round(some.reduce((total, row) => total + (row.amount ?? 0), 0) * 100) / 100;
  return {
    successfulPayments: successful.length,
    successfulAmount: sum(successful),
    failedPayments: purchases.filter(
      row => row.status !== 'success' && !isBlocked(row)
    ).length,
    blockedPayments: blocked.length,
    blockedSignups: blocked.filter(row => row.origin === 'hpp').length,
    blockedCountries: [...byCountry.entries()]
      .map(([country, count]) => ({country, count}))
      .sort((a, b) => b.count - a.count),
    refunds: refunds.length,
    refundedAmount: sum(refunds),
  };
};

type WeeklySummary = TransactionCounts & {
  newAccounts: number;
  newSubscriptions: number;
  cancelledSubscriptions: number;
  alertsSent: number;
};

const ukDate = (date: Date) =>
  DateTime.fromJSDate(date).setZone('Europe/London').toFormat('ccc d LLL yyyy');
const ukDateTime = (date: Date) =>
  DateTime.fromJSDate(date).setZone('Europe/London').toFormat('ccc d LLL, HH:mm');
const pounds = (amount: number) => `£${amount.toFixed(2)}`;

const countriesLine = (counts: TransactionCounts) =>
  counts.blockedCountries
    .slice(0, 5)
    .map(({country, count}) => `${country} ${count}`)
    .join(', ');

const layout = (heading: string, paragraphs: ReadonlyArray<string>, rows: ReadonlyArray<[string, string]>) =>
  mjml2html(`
    <mjml>
      <mj-body width="600px">
        <mj-section background-color="#fa990e">
          <mj-column>
            <mj-text align="center" color="#111" font-size="28px">Makespace</mj-text>
          </mj-column>
        </mj-section>
        <mj-section>
          <mj-column>
            <mj-text font-size="20px" color="#111">${heading}</mj-text>
            ${paragraphs.map(p => `<mj-text font-size="16px" color="#111">${p}</mj-text>`).join('\n')}
            <mj-table font-size="16px" color="#111">
              ${rows.map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0">${label}</td><td style="padding:4px 0"><strong>${value}</strong></td></tr>`).join('\n')}
            </mj-table>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `).html;

const asText = (heading: string, paragraphs: ReadonlyArray<string>, rows: ReadonlyArray<[string, string]>) =>
  [heading, '', ...paragraphs.flatMap(p => [p, '']), ...rows.map(([label, value]) => `${label}: ${value}`), ''].join('\n');

export const alertEmail = (
  recipient: Email['recipient'],
  counts: TransactionCounts,
  window: {hours: number; threshold: number; until: Date}
): Email => {
  const subject = `Unusual activity on Recurly: ${counts.blockedPayments} blocked payments in ${window.hours} hours`;
  const heading = 'Possible card-testing attack on Recurly';
  const paragraphs = [
    `Recurly has recorded ${counts.blockedPayments} blocked payments in the ${window.hours} hours up to ${ukDateTime(window.until)}, at or above the alert level of ${window.threshold}. Normally there are none or one or two a day.`,
    `A burst of blocked payments, especially through the signup page and from abroad, usually means bots testing stolen cards. Each attempt can incur a Recurly fee, and any that succeed are charges on stolen cards that will need refunding.`,
    `What to do: check the Transactions page in Recurly; contact Recurly support to block the traffic; refund and terminate any subscriptions created by successful fraudulent payments before they are disputed or renew.`,
    `You will not be emailed about this again for ${window.hours} hours, even if it continues.`,
  ];
  const rows: ReadonlyArray<[string, string]> = [
    ['Blocked payments', String(counts.blockedPayments)],
    ['…through the signup page', String(counts.blockedSignups)],
    ['…from (country of connection)', countriesLine(counts) || 'not recorded'],
    ['Failed payments (other reasons)', String(counts.failedPayments)],
    ['Successful payments', `${counts.successfulPayments} (${pounds(counts.successfulAmount)})`],
  ];
  return {
    recipient,
    subject,
    text: asText(heading, paragraphs, rows),
    html: layout(heading, paragraphs, rows),
  };
};

export const summaryEmail = (
  recipient: Email['recipient'],
  summary: WeeklySummary,
  period: {start: Date; end: Date; dataAsOf: Date | null}
): Email => {
  const range = `${ukDate(period.start)} to ${ukDate(new Date(period.end.getTime() - 1))}`;
  const subject = `Recurly weekly summary: ${range}`;
  const heading = 'Recurly this week';
  const paragraphs = [
    `Payments and accounts in Recurly from ${range}.`,
    summary.alertsSent > 0
      ? `${summary.alertsSent} suspicious-activity alert${summary.alertsSent === 1 ? ' was' : 's were'} sent this week.`
      : summary.blockedPayments > 0
        ? 'Some payments were blocked, but not enough to look like an attack.'
        : 'No blocked payments this week.',
    period.dataAsOf
      ? `Recurly data last refreshed ${ukDateTime(period.dataAsOf)}.`
      : 'The app has not yet synced any Recurly payments.',
  ];
  const rows: ReadonlyArray<[string, string]> = [
    ['Successful payments', `${summary.successfulPayments} (${pounds(summary.successfulAmount)})`],
    ['Failed payments', String(summary.failedPayments)],
    ['Blocked payments', String(summary.blockedPayments)],
    ...(summary.blockedPayments > 0
      ? [['…from (country of connection)', countriesLine(summary) || 'not recorded'] as [string, string]]
      : []),
    ['Refunds', `${summary.refunds} (${pounds(summary.refundedAmount)})`],
    ['New accounts', String(summary.newAccounts)],
    ['New subscriptions', String(summary.newSubscriptions)],
    ['Cancelled subscriptions', String(summary.cancelledSubscriptions)],
  ];
  return {
    recipient,
    subject,
    text: asText(heading, paragraphs, rows),
    html: layout(heading, paragraphs, rows),
  };
};

// The summary covers Monday 09:00 to Monday 09:00, UK time, and goes out once
// the week has ended: the most recent such boundary at or before `now`.
export const lastSummaryBoundary = (now: Date): Date => {
  const uk = DateTime.fromJSDate(now).setZone('Europe/London');
  const thisMonday = uk.startOf('week').set({hour: 9});
  return (uk >= thisMonday ? thisMonday : thisMonday.minus({weeks: 1})).toJSDate();
};
