import {TestFramework, initTestFramework} from '../test-framework';
import * as O from 'fp-ts/Option';
import {
  recurlyInvoiceTable,
  recurlySubscriptionTable,
  recurlyTransactionTable,
} from '../../../src/sync-worker/recurly/recurly-data-table';
import {getRecurlyStatusForMember} from '../../../src/read-models/external-state/recurly-status';
import {getBillingForMember} from '../../../src/read-models/external-state/recurly-billing';
import {EmailAddress} from '../../../src/types';
import {sql} from 'drizzle-orm';

// The recurly cache is matched case-insensitively (lower(email)), which the
// plain-email indexes cannot serve. A name-only check would pass with the
// right name over the wrong columns, so these assert the ordered column
// definitions, that representative lookups plan through the expression
// indexes, and that case-insensitive matching still works - mixed-case rows
// predate the cache's lowercasing.
describe('recurly cache indexes', () => {
  let framework: TestFramework;

  const email = 'payer@example.com' as EmailAddress;
  const member = {
    emails: [
      {
        emailAddress: email,
        verifiedAt: O.some(new Date('2025-01-01T00:00:00.000Z')),
        addedAt: new Date('2025-01-01T00:00:00.000Z'),
        verificationLastSent: O.none,
        linkedByAdmin: false,
      },
    ],
  };

  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  const indexColumns = async (
    index: string
  ): Promise<ReadonlyArray<string>> => {
    const rows = await framework.extDB.all<{name: string}>(
      sql.raw(`PRAGMA index_info(${index})`)
    );
    return rows.map(row => row.name);
  };

  const indexDefinition = async (index: string): Promise<string> => {
    const rows = await framework.extDB.all<{sql: string}>(
      sql`SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ${index}`
    );
    return rows[0]?.sql ?? '';
  };

  const planDetails = async (sqlText: string): Promise<ReadonlyArray<string>> => {
    const rows = await framework.extDB.all<{detail: string}>(
      sql.raw(`EXPLAIN QUERY PLAN ${sqlText}`)
    );
    return rows.map(row => row.detail);
  };

  it('defines the expression indexes over lower(email) and the freshness column', async () => {
    // PRAGMA index_info reports an expression column as null, so the exact
    // expression comes from the stored definition.
    expect(await indexDefinition('recurly_subscriptions_lower_email')).toBe(
      'CREATE INDEX recurly_subscriptions_lower_email ON recurly_subscriptions (lower(email), cacheLastUpdated)'
    );
    expect(await indexDefinition('recurly_invoices_lower_email')).toBe(
      'CREATE INDEX recurly_invoices_lower_email ON recurly_invoices (lower(email))'
    );
    expect(await indexColumns('recurly_subscriptions_lower_email')).toEqual([
      null,
      'cacheLastUpdated',
    ]);
    expect(await indexColumns('recurly_invoices_lower_email')).toEqual([null]);
  });

  it('plans the cached lookups through the expression indexes, not scans', async () => {
    const [subscriptionPlan] = await planDetails(
      'SELECT hasActiveSubscription FROM recurly_subscriptions WHERE lower(email) = \'payer@example.com\' AND cacheLastUpdated > 1767225600000'
    );
    expect(subscriptionPlan).toContain('recurly_subscriptions_lower_email');

    const [invoicePlan] = await planDetails(
      "SELECT * FROM recurly_invoices WHERE lower(email) = 'payer@example.com'"
    );
    expect(invoicePlan).toContain('recurly_invoices_lower_email');
  });

  it('still matches subscriptions case-insensitively with the indexes in place', async () => {
    await framework.extDB
      .insert(recurlySubscriptionTable)
      .values({
        email: 'Payer@Example.com',
        cacheLastUpdated: new Date(),
        hasActiveSubscription: true,
        hasFutureSubscription: false,
        hasCanceledSubscription: false,
        hasPausedSubscription: false,
        hasPastDueInvoice: false,
      })
      .run();
    const status = await getRecurlyStatusForMember(framework.extDB)(member);
    expect(status).toBe('active');
  });

  it('still associates invoices with the payment attempts that explain them', async () => {
    await framework.extDB
      .insert(recurlyInvoiceTable)
      .values({
        id: 'inv_idx',
        email: 'Payer@Example.com',
        number: '1234',
        state: 'past_due',
        currency: 'GBP',
        total: 25,
        paid: 0,
        balance: 25,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        dueAt: new Date('2026-09-01T00:00:00.000Z'),
        cachedAt: new Date('2026-09-29T12:00:00.000Z'),
      })
      .run();
    await framework.extDB
      .insert(recurlyTransactionTable)
      .values({
        id: 'tx_idx',
        invoiceId: 'inv_idx',
        email: null,
        status: 'declined',
        success: false,
        customerMessage: 'Your card has expired.',
        createdAt: new Date('2026-09-02T00:00:00.000Z'),
        cachedAt: new Date('2026-09-29T12:00:00.000Z'),
      })
      .run();

    const billing = await getBillingForMember(framework.extDB)(member);
    expect(billing.invoices).toHaveLength(1);
    expect(billing.totalOutstanding).toBe(25);
    expect(billing.invoices[0]?.attempts).toHaveLength(1);
    expect(billing.invoices[0]?.attempts[0]?.message).toStrictEqual(
      O.some('Your card has expired.')
    );
    expect(billing.invoices[0]?.issues).toEqual(['declined']);
  });
});
