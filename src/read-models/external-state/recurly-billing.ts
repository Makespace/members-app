import {and, inArray, sql} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {
  recurlyInvoiceTable,
  recurlyTransactionTable,
} from '../../sync-worker/recurly/recurly-data-table';
import {MemberCoreInfo} from '../shared-state/return-types';

// Why an invoice has not been paid. More than one can be true at once - a
// manual invoice can also be one Recurly has stopped chasing - so this is a
// list, in the order a person would want to hear them.
export type InvoiceIssue =
  | 'expired-card' // the card on file ran out before the attempt
  | 'declined' // the bank said no, for some other reason
  | 'no-attempt' // nothing has been tried against it at all
  | 'manual-unpaid' // not collected by card: nobody has tried, and nobody will
  | 'partly-paid' // some of it has been paid
  | 'dunning-exhausted'; // Recurly has given up chasing

export type PaymentAttempt = {
  at: O.Option<Date>;
  succeeded: boolean;
  status: O.Option<string>;
  // The most human of the three renderings Recurly gives of the same refusal.
  message: O.Option<string>;
  cardType: O.Option<string>;
  lastFour: O.Option<string>;
  expMonth: O.Option<number>;
  expYear: O.Option<number>;
};

export type BillingInvoice = {
  id: string;
  number: O.Option<string>;
  state: string;
  collectionMethod: O.Option<string>;
  currency: O.Option<string>;
  total: O.Option<number>;
  paid: O.Option<number>;
  balance: O.Option<number>;
  createdAt: O.Option<Date>;
  dueAt: O.Option<Date>;
  dunningEventsSent: O.Option<number>;
  isOutstanding: boolean;
  daysOverdue: O.Option<number>;
  issues: ReadonlyArray<InvoiceIssue>;
  attempts: ReadonlyArray<PaymentAttempt>;
};

export type MemberBilling = {
  invoices: ReadonlyArray<BillingInvoice>;
  // Measured from the oldest invoice still owing, not from the most recent
  // failure: dunning retries would otherwise keep resetting it, and somebody
  // forty days behind would read as having failed yesterday.
  daysOverdue: O.Option<number>;
  totalOutstanding: number;
  currency: O.Option<string>;
  lastPaidAt: O.Option<Date>;
  // Newest cachedAt across the rows, so a page can say how old this is rather
  // than presenting a stale answer as a current one.
  cachedAt: O.Option<Date>;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Recurly voids an invoice rather than deleting it; a voided one is owed by
// nobody however its balance reads.
const isOutstanding = (state: string, balance: number | null): boolean =>
  state !== 'voided' && (balance ?? 0) > 0;

const daysBetween = (from: Date, to: Date): number =>
  Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);

const cardHasExpired = (
  attempt: PaymentAttempt,
  now: Date
): boolean => {
  if (O.isNone(attempt.expYear) || O.isNone(attempt.expMonth)) {
    return false;
  }
  // Cards are good until the end of their month.
  const expiredAfter = new Date(
    Date.UTC(attempt.expYear.value, attempt.expMonth.value, 1)
  );
  return expiredAfter.getTime() <= now.getTime();
};

// Pure, so the thing an administrator acts on can be tested without a database.
// `attempts` is newest first.
export const invoiceIssues = (
  invoice: {
    state: string;
    balance: number | null;
    paid: number | null;
    collectionMethod: string | null;
    finalDunningEvent: boolean | null;
  },
  attempts: ReadonlyArray<PaymentAttempt>,
  now: Date
): ReadonlyArray<InvoiceIssue> => {
  if (!isOutstanding(invoice.state, invoice.balance)) {
    return [];
  }
  const issues: InvoiceIssue[] = [];
  const latestFailure = attempts.find(attempt => !attempt.succeeded);

  if (invoice.collectionMethod === 'manual') {
    issues.push('manual-unpaid');
  } else if (attempts.length === 0) {
    issues.push('no-attempt');
  } else if (latestFailure !== undefined) {
    issues.push(
      cardHasExpired(latestFailure, now) ? 'expired-card' : 'declined'
    );
  }

  if ((invoice.paid ?? 0) > 0) {
    issues.push('partly-paid');
  }
  if (invoice.finalDunningEvent === true) {
    issues.push('dunning-exhausted');
  }
  return issues;
};

// Which invoices are worth putting in front of somebody deciding what to do
// about a member. Everything still owed, plus every invoice raised since the
// oldest of those - so a payment that went through in between is shown too.
//
// That sequence is the useful part: three months paid then two missed reads
// very differently from five missed in a row, and the paid ones are what tell
// them apart. Anything older than the trouble is history, and lives on the
// member's full billing page instead.
//
// `invoices` arrives newest first, and is returned the same way.
export const invoicesSinceFirstUnpaid = (
  invoices: ReadonlyArray<BillingInvoice>
): ReadonlyArray<BillingInvoice> => {
  const outstanding = invoices.filter(invoice => invoice.isOutstanding);
  if (outstanding.length === 0) {
    return [];
  }
  const raisedAt = (invoice: BillingInvoice): number =>
    O.isSome(invoice.createdAt) ? invoice.createdAt.value.getTime() : 0;
  // The oldest thing still owed is where the trouble starts.
  const start = Math.min(...outstanding.map(raisedAt));
  return invoices.filter(
    invoice => invoice.isOutstanding || raisedAt(invoice) >= start
  );
};

const lowercasedInvoiceEmail = sql`lower(${recurlyInvoiceTable.email})`;

const optionalDate = (value: Date | null): O.Option<Date> =>
  O.fromNullable(value);

// Recurly says the same thing three ways, from plainest to most technical.
const bestMessage = (row: {
  customerMessage: string | null;
  statusMessage: string | null;
  gatewayMessage: string | null;
}): O.Option<string> =>
  O.fromNullable(
    row.customerMessage ?? row.statusMessage ?? row.gatewayMessage ?? null
  );

export const getBillingForMember =
  (extDB: ExternalStateDB) =>
  async (
    member: Pick<MemberCoreInfo, 'emails'>,
    now: Date = new Date()
  ): Promise<MemberBilling> => {
    const emails = member.emails
      .filter(email => O.isSome(email.verifiedAt))
      .map(email => (email.emailAddress).toLowerCase());

    const empty: MemberBilling = {
      invoices: [],
      daysOverdue: O.none,
      totalOutstanding: 0,
      currency: O.none,
      lastPaidAt: O.none,
      cachedAt: O.none,
    };
    if (emails.length === 0) {
      return empty;
    }

    const invoiceRows = await extDB
      .select()
      .from(recurlyInvoiceTable)
      .where(and(inArray(lowercasedInvoiceEmail, emails)))
      .all();
    if (invoiceRows.length === 0) {
      return empty;
    }

    // By invoice id rather than by address: a payment attempt whose own account
    // carried no address still belongs to the invoice it paid.
    const transactionRows = await extDB
      .select()
      .from(recurlyTransactionTable)
      .where(
        inArray(
          recurlyTransactionTable.invoiceId,
          invoiceRows.map(row => row.id)
        )
      )
      .all();

    const attemptsByInvoice = new Map<string, PaymentAttempt[]>();
    for (const row of transactionRows) {
      if (row.invoiceId === null) {
        continue;
      }
      const attempt: PaymentAttempt = {
        at: optionalDate(row.collectedAt ?? row.createdAt),
        succeeded: row.success === true,
        status: O.fromNullable(row.status),
        message: bestMessage(row),
        cardType: O.fromNullable(row.cardType),
        lastFour: O.fromNullable(row.lastFour),
        expMonth: O.fromNullable(row.expMonth),
        expYear: O.fromNullable(row.expYear),
      };
      const existing = attemptsByInvoice.get(row.invoiceId);
      if (existing === undefined) {
        attemptsByInvoice.set(row.invoiceId, [attempt]);
      } else {
        existing.push(attempt);
      }
    }
    // Newest first, so "the latest attempt" is the head of the list.
    for (const attempts of attemptsByInvoice.values()) {
      attempts.sort((a, b) => {
        const at = O.isSome(a.at) ? a.at.value.getTime() : 0;
        const bt = O.isSome(b.at) ? b.at.value.getTime() : 0;
        return bt - at;
      });
    }

    const invoices: BillingInvoice[] = invoiceRows
      .map(row => {
        const attempts = attemptsByInvoice.get(row.id) ?? [];
        const outstanding = isOutstanding(row.state, row.balance);
        const dueAt = optionalDate(row.dueAt);
        return {
          id: row.id,
          number: O.fromNullable(row.number),
          state: row.state,
          collectionMethod: O.fromNullable(row.collectionMethod),
          currency: O.fromNullable(row.currency),
          total: O.fromNullable(row.total),
          paid: O.fromNullable(row.paid),
          balance: O.fromNullable(row.balance),
          createdAt: optionalDate(row.createdAt),
          dueAt,
          dunningEventsSent: O.fromNullable(row.dunningEventsSent),
          isOutstanding: outstanding,
          daysOverdue:
            outstanding && O.isSome(dueAt) && dueAt.value.getTime() < now.getTime()
              ? O.some(daysBetween(dueAt.value, now))
              : O.none,
          issues: invoiceIssues(row, attempts, now),
          attempts,
        };
      })
      .sort((a, b) => {
        const at = O.isSome(a.createdAt) ? a.createdAt.value.getTime() : 0;
        const bt = O.isSome(b.createdAt) ? b.createdAt.value.getTime() : 0;
        return bt - at;
      });

    const outstandingInvoices = invoices.filter(invoice => invoice.isOutstanding);
    const overdueDays = outstandingInvoices
      .map(invoice => invoice.daysOverdue)
      .filter(O.isSome)
      .map(days => days.value);

    const paidAts = invoices
      .flatMap(invoice => invoice.attempts)
      .filter(attempt => attempt.succeeded)
      .map(attempt => attempt.at)
      .filter(O.isSome)
      .map(at => at.value.getTime());

    const cachedAts = invoiceRows.map(row => row.cachedAt.getTime());

    return {
      invoices,
      daysOverdue:
        overdueDays.length === 0 ? O.none : O.some(Math.max(...overdueDays)),
      totalOutstanding: outstandingInvoices.reduce(
        (total, invoice) => total + O.getOrElse(() => 0)(invoice.balance),
        0
      ),
      currency: invoices[0]?.currency ?? O.none,
      lastPaidAt:
        paidAts.length === 0 ? O.none : O.some(new Date(Math.max(...paidAts))),
      cachedAt:
        cachedAts.length === 0
          ? O.none
          : O.some(new Date(Math.max(...cachedAts))),
    };
  };
