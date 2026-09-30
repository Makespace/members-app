import {and, gt, ne, sql} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {
  recurlyInvoiceTable,
  recurlySubscriptionTable,
  recurlyTransactionTable,
} from '../../sync-worker/recurly/recurly-data-table';
import {MemberCoreInfo} from '../shared-state/return-types';
import {InvoiceIssue, invoiceIssues, PaymentAttempt} from './recurly-billing';

// Everybody whose membership payments may need a person to do something,
// gathered in a handful of queries rather than one per member.

type BillingConcernKind =
  // Owes money and is not paused: the ordinary case.
  | 'overdue'
  // Paused in Recurly, but with a balance from before the pause. A pause stops
  // future billing; it does not clear what was already owed, so these would
  // otherwise read as "leave alone" and never be chased.
  | 'paused-owing'
  // No live subscription at all. Generates no invoice, so an invoice-only view
  // never sees them, and they keep their fob indefinitely.
  | 'lapsed';

export type BillingConcern = {
  memberNumber: number;
  name: O.Option<string>;
  kind: BillingConcernKind;
  daysOverdue: O.Option<number>;
  totalOutstanding: number;
  currency: O.Option<string>;
  issues: ReadonlyArray<InvoiceIssue>;
  lastInvoiceAt: O.Option<Date>;
};

// A Recurly account that owes money and matches no member. Without this they
// escape the process entirely - nobody is looking at Recurly directly.
export type UnlinkedDebt = {
  email: string;
  totalOutstanding: number;
  daysOverdue: O.Option<number>;
};

type BillingOverview = {
  concerns: ReadonlyArray<BillingConcern>;
  unlinked: ReadonlyArray<UnlinkedDebt>;
  cachedAt: O.Option<Date>;
  isStale: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The same bar the membership status uses. Past this the copy is not evidence
// of anything, and the page says so instead of naming people.
const STALE_AFTER = 3 * MS_PER_DAY;

// Somebody whose last invoice was years ago left; they are not a job. Only a
// recently-lapsed subscription is worth anybody's attention.
const RECENTLY_LAPSED_WITHIN = 183 * MS_PER_DAY;

const daysBetween = (from: Date, to: Date): number =>
  Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);

const verifiedEmails = (member: Pick<MemberCoreInfo, 'emails'>): string[] =>
  member.emails
    .filter(email => O.isSome(email.verifiedAt))
    .map(email => email.emailAddress.toLowerCase());

type InvoiceRow = typeof recurlyInvoiceTable.$inferSelect;

// Everything owed by one address, reduced to the facts a page needs.
const summarise = (invoices: ReadonlyArray<InvoiceRow>, now: Date) => {
  const withDue = invoices.filter(invoice => invoice.dueAt !== null);
  const oldestDue =
    withDue.length === 0
      ? null
      : withDue.reduce((oldest, invoice) =>
          (invoice.dueAt?.getTime() ?? 0) < (oldest.dueAt?.getTime() ?? 0)
            ? invoice
            : oldest
        );
  return {
    oldest: oldestDue,
    totalOutstanding: invoices.reduce(
      (total, invoice) => total + (invoice.balance ?? 0),
      0
    ),
    currency: O.fromNullable(invoices[0]?.currency ?? null),
    daysOverdue:
      oldestDue !== null &&
      oldestDue.dueAt !== null &&
      oldestDue.dueAt.getTime() < now.getTime()
        ? O.some(daysBetween(oldestDue.dueAt, now))
        : O.none,
  };
};

export const getBillingOverview =
  (extDB: ExternalStateDB) =>
  async (
    members: ReadonlyArray<Pick<MemberCoreInfo, 'memberNumber' | 'name' | 'emails'>>,
    now: Date = new Date()
  ): Promise<BillingOverview> => {
    // Everything still owed, in one go.
    const outstandingRows = await extDB
      .select()
      .from(recurlyInvoiceTable)
      .where(
        and(gt(recurlyInvoiceTable.balance, 0), ne(recurlyInvoiceTable.state, 'voided'))
      )
      .all();

    const subscriptions = await extDB
      .select()
      .from(recurlySubscriptionTable)
      .all();

    // When each address was last invoiced at all, to tell a lapse from a
    // departure. One aggregate rather than a scan per member.
    const lastInvoiceRows = await extDB
      .select({
        email: sql<string>`lower(${recurlyInvoiceTable.email})`.as('email'),
        lastAt: sql<number | null>`max(${recurlyInvoiceTable.createdAt})`.as(
          'lastAt'
        ),
        newestCachedAt: sql<number | null>`max(${recurlyInvoiceTable.cachedAt})`.as(
          'newestCachedAt'
        ),
      })
      .from(recurlyInvoiceTable)
      .groupBy(sql`lower(${recurlyInvoiceTable.email})`)
      .all();

    const attemptsByInvoice = new Map<string, PaymentAttempt[]>();
    if (outstandingRows.length > 0) {
      const transactions = await extDB
        .select()
        .from(recurlyTransactionTable)
        .all();
      for (const row of transactions) {
        if (row.invoiceId === null) {
          continue;
        }
        const existing = attemptsByInvoice.get(row.invoiceId) ?? [];
        existing.push({
          at: O.fromNullable(row.collectedAt ?? row.createdAt),
          succeeded: row.success === true,
          status: O.fromNullable(row.status),
          message: O.fromNullable(
            row.customerMessage ?? row.statusMessage ?? row.gatewayMessage
          ),
          cardType: O.fromNullable(row.cardType),
          lastFour: O.fromNullable(row.lastFour),
          expMonth: O.fromNullable(row.expMonth),
          expYear: O.fromNullable(row.expYear),
        });
        attemptsByInvoice.set(row.invoiceId, existing);
      }
      for (const attempts of attemptsByInvoice.values()) {
        attempts.sort((a, b) => {
          const at = O.isSome(a.at) ? a.at.value.getTime() : 0;
          const bt = O.isSome(b.at) ? b.at.value.getTime() : 0;
          return bt - at;
        });
      }
    }

    const owedByEmail = new Map<string, InvoiceRow[]>();
    for (const row of outstandingRows) {
      if (row.email === null) {
        continue;
      }
      const key = row.email.toLowerCase();
      owedByEmail.set(key, [...(owedByEmail.get(key) ?? []), row]);
    }

    const pausedEmails = new Set(
      subscriptions
        .filter(row => row.hasPausedSubscription)
        .map(row => row.email.toLowerCase())
    );
    const liveEmails = new Set(
      subscriptions
        .filter(
          row =>
            row.hasActiveSubscription ||
            row.hasFutureSubscription ||
            row.hasPausedSubscription ||
            row.hasCanceledSubscription
        )
        .map(row => row.email.toLowerCase())
    );
    const knownEmails = new Set(
      subscriptions.map(row => row.email.toLowerCase())
    );
    const lastInvoiceByEmail = new Map(
      lastInvoiceRows.map(row => [row.email, row.lastAt])
    );

    const newestCachedAt = lastInvoiceRows.reduce<number | null>(
      (newest, row) =>
        row.newestCachedAt !== null && (newest === null || row.newestCachedAt > newest)
          ? row.newestCachedAt
          : newest,
      null
    );

    const concerns: BillingConcern[] = [];
    const claimedEmails = new Set<string>();

    for (const member of members) {
      const emails = verifiedEmails(member);
      emails.forEach(email => claimedEmails.add(email));

      const owed = emails.flatMap(email => owedByEmail.get(email) ?? []);
      if (owed.length > 0) {
        const {oldest, totalOutstanding, currency, daysOverdue} = summarise(
          owed,
          now
        );
        concerns.push({
          memberNumber: member.memberNumber,
          name: member.name,
          kind: emails.some(email => pausedEmails.has(email))
            ? 'paused-owing'
            : 'overdue',
          daysOverdue,
          totalOutstanding,
          currency,
          issues:
            oldest === null
              ? []
              : invoiceIssues(
                  oldest,
                  attemptsByInvoice.get(oldest.id) ?? [],
                  now
                ),
          lastInvoiceAt: O.none,
        });
        continue;
      }

      // Nothing owed. They may still have stopped paying us altogether, which
      // raises no invoice and so shows up nowhere else.
      const hasFreshData = emails.some(email => knownEmails.has(email));
      const hasLive = emails.some(email => liveEmails.has(email));
      if (!hasFreshData || hasLive) {
        continue;
      }
      const lastInvoiceAt = emails
        .map(email => lastInvoiceByEmail.get(email) ?? null)
        .filter((at): at is number => at !== null)
        .reduce<number | null>(
          (newest, at) => (newest === null || at > newest ? at : newest),
          null
        );
      if (
        lastInvoiceAt !== null &&
        now.getTime() - lastInvoiceAt <= RECENTLY_LAPSED_WITHIN
      ) {
        concerns.push({
          memberNumber: member.memberNumber,
          name: member.name,
          kind: 'lapsed',
          daysOverdue: O.none,
          totalOutstanding: 0,
          currency: O.none,
          issues: [],
          lastInvoiceAt: O.some(new Date(lastInvoiceAt)),
        });
      }
    }

    // Money owed by an address that belongs to no member we know of.
    const unlinked: UnlinkedDebt[] = [];
    for (const [email, invoices] of owedByEmail) {
      if (claimedEmails.has(email)) {
        continue;
      }
      const {totalOutstanding, daysOverdue} = summarise(invoices, now);
      unlinked.push({email, totalOutstanding, daysOverdue});
    }

    return {
      concerns,
      unlinked,
      cachedAt: O.fromNullable(
        newestCachedAt === null ? null : new Date(newestCachedAt)
      ),
      isStale:
        newestCachedAt === null || now.getTime() - newestCachedAt > STALE_AFTER,
    };
  };
