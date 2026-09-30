import {createClient, Client} from '@libsql/client';
import * as O from 'fp-ts/Option';
import {
  ensureExtDBTablesExist,
  ExternalStateDB,
  initExternalStateDB,
} from '../../../src/sync-worker/external-state-db';
import {
  recurlyInvoiceTable,
  recurlyTransactionTable,
} from '../../../src/sync-worker/recurly/recurly-data-table';
import {
  BillingInvoice,
  getBillingForMember,
  invoiceIssues,
  invoicesSinceFirstUnpaid,
  PaymentAttempt,
} from '../../../src/read-models/external-state/recurly-billing';
import {EmailAddress} from '../../../src/types';

const NOW = new Date('2026-09-29T12:00:00.000Z');

const attempt = (over: Partial<PaymentAttempt> = {}): PaymentAttempt => ({
  at: O.some(new Date('2026-08-02T00:00:00.000Z')),
  succeeded: false,
  status: O.some('declined'),
  message: O.some('Your card has expired.'),
  cardType: O.some('Visa'),
  lastFour: O.some('4242'),
  expMonth: O.none,
  expYear: O.none,
  ...over,
});

describe('why an invoice is unpaid', () => {
  const unpaid = {
    state: 'past_due',
    balance: 25,
    paid: null,
    collectionMethod: 'automatic',
    finalDunningEvent: null,
  };

  it('says nothing about an invoice that is settled', () => {
    expect(
      invoiceIssues({...unpaid, state: 'paid', balance: 0}, [], NOW)
    ).toEqual([]);
  });

  it('says nothing about a voided invoice, whatever its balance reads', () => {
    expect(
      invoiceIssues({...unpaid, state: 'voided'}, [attempt()], NOW)
    ).toEqual([]);
  });

  it('blames an expired card when the card ran out before now', () => {
    const expired = attempt({expMonth: O.some(4), expYear: O.some(2026)});
    expect(invoiceIssues(unpaid, [expired], NOW)).toEqual(['expired-card']);
  });

  it('treats a card as good until the end of its expiry month', () => {
    const expiringThisMonth = attempt({
      expMonth: O.some(9),
      expYear: O.some(2026),
    });
    expect(invoiceIssues(unpaid, [expiringThisMonth], NOW)).toEqual([
      'declined',
    ]);
  });

  it('blames the bank when the card was still in date', () => {
    const declined = attempt({
      expMonth: O.some(12),
      expYear: O.some(2030),
      message: O.some('Insufficient funds.'),
    });
    expect(invoiceIssues(unpaid, [declined], NOW)).toEqual(['declined']);
  });

  it('says nobody has tried when there is no attempt at all', () => {
    expect(invoiceIssues(unpaid, [], NOW)).toEqual(['no-attempt']);
  });

  it('does not call a manual invoice a failed payment', () => {
    // Nobody tried to take this by card, so there is no decline to explain.
    expect(
      invoiceIssues({...unpaid, collectionMethod: 'manual'}, [], NOW)
    ).toEqual(['manual-unpaid']);
  });

  it('notes a part payment alongside the reason', () => {
    expect(invoiceIssues({...unpaid, paid: 10}, [], NOW)).toEqual([
      'no-attempt',
      'partly-paid',
    ]);
  });

  it('notes when Recurly has stopped chasing', () => {
    expect(
      invoiceIssues({...unpaid, finalDunningEvent: true}, [], NOW)
    ).toEqual(['no-attempt', 'dunning-exhausted']);
  });

  it('reads the most recent attempt, not the first', () => {
    const older = attempt({
      at: O.some(new Date('2026-07-01T00:00:00.000Z')),
      expMonth: O.some(12),
      expYear: O.some(2030),
    });
    const newer = attempt({
      at: O.some(new Date('2026-08-01T00:00:00.000Z')),
      expMonth: O.some(4),
      expYear: O.some(2026),
    });
    // Newest first, as the read model orders them.
    expect(invoiceIssues(unpaid, [newer, older], NOW)).toEqual([
      'expired-card',
    ]);
  });
});

describe("a member's billing", () => {
  let extDBClient: Client;
  let extDB: ExternalStateDB;

  const email = 'payer@example.com' as EmailAddress;
  const member = {
    emails: [
      {
        emailAddress: email,
        verifiedAt: O.some(new Date('2025-01-01T00:00:00.000Z')),
        addedAt: new Date('2025-01-01T00:00:00.000Z'),
        verificationLastSent: O.none,
      },
    ],
  };

  beforeEach(async () => {
    extDBClient = createClient({url: ':memory:'});
    extDB = initExternalStateDB(extDBClient);
    await ensureExtDBTablesExist(extDB)();
  });
  afterEach(() => {
    extDBClient.close();
  });

  const addInvoice = async (over: Record<string, unknown> = {}) =>
    extDB
      .insert(recurlyInvoiceTable)
      .values({
        id: 'inv_1',
        email,
        accountId: 'acct_1',
        number: '1234',
        state: 'past_due',
        collectionMethod: 'automatic',
        currency: 'GBP',
        total: 25,
        paid: 0,
        balance: 25,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        dueAt: new Date('2026-09-01T00:00:00.000Z'),
        cachedAt: NOW,
        ...over,
      })
      .run();

  it('finds nothing for a member with no verified address', async () => {
    const billing = await getBillingForMember(extDB)(
      {emails: [{...member.emails[0], verifiedAt: O.none}]},
      NOW
    );
    expect(billing.invoices).toHaveLength(0);
  });

  it('matches the address whatever case it was recorded in', async () => {
    await addInvoice({email: 'Payer@Example.com'});
    const billing = await getBillingForMember(extDB)(member, NOW);
    expect(billing.invoices).toHaveLength(1);
  });

  it('counts the days overdue from when the invoice was due', async () => {
    await addInvoice();
    const billing = await getBillingForMember(extDB)(member, NOW);
    expect(billing.daysOverdue).toStrictEqual(O.some(28));
    expect(billing.totalOutstanding).toBe(25);
  });

  it('takes the oldest unpaid invoice as the clock, not the newest', async () => {
    await addInvoice();
    await addInvoice({
      id: 'inv_2',
      createdAt: new Date('2026-09-20T00:00:00.000Z'),
      dueAt: new Date('2026-09-25T00:00:00.000Z'),
    });
    const billing = await getBillingForMember(extDB)(member, NOW);
    expect(billing.daysOverdue).toStrictEqual(O.some(28));
    expect(billing.totalOutstanding).toBe(50);
  });

  it('stops the clock once the balance is cleared', async () => {
    await addInvoice({state: 'paid', balance: 0, paid: 25});
    const billing = await getBillingForMember(extDB)(member, NOW);
    expect(billing.daysOverdue).toStrictEqual(O.none);
    expect(billing.totalOutstanding).toBe(0);
    expect(billing.invoices[0]?.isOutstanding).toBe(false);
  });

  it('attaches the payment attempts that explain an unpaid invoice', async () => {
    await addInvoice();
    await extDB
      .insert(recurlyTransactionTable)
      .values({
        id: 'tx_1',
        invoiceId: 'inv_1',
        // No address of its own - it belongs to the invoice, not an account.
        email: null,
        accountId: null,
        status: 'declined',
        success: false,
        customerMessage: 'Your card has expired.',
        cardType: 'Visa',
        lastFour: '4242',
        expMonth: 4,
        expYear: 2026,
        createdAt: new Date('2026-09-02T00:00:00.000Z'),
        cachedAt: NOW,
      })
      .run();

    const billing = await getBillingForMember(extDB)(member, NOW);
    expect(billing.invoices[0]?.issues).toEqual(['expired-card']);
    expect(billing.invoices[0]?.attempts).toHaveLength(1);
    expect(billing.invoices[0]?.attempts[0]?.message).toStrictEqual(
      O.some('Your card has expired.')
    );
  });

  it('reports when somebody last actually paid', async () => {
    await addInvoice({state: 'paid', balance: 0, paid: 25});
    await extDB
      .insert(recurlyTransactionTable)
      .values({
        id: 'tx_ok',
        invoiceId: 'inv_1',
        email,
        status: 'success',
        success: true,
        collectedAt: new Date('2026-08-02T00:00:00.000Z'),
        cachedAt: NOW,
      })
      .run();

    const billing = await getBillingForMember(extDB)(member, NOW);
    expect(billing.lastPaidAt).toStrictEqual(
      O.some(new Date('2026-08-02T00:00:00.000Z'))
    );
  });
});

describe('which invoices are worth showing on a member page', () => {
  const at = (iso: string) => O.some(new Date(iso));
  const inv = (
    id: string,
    createdAt: string,
    isOutstanding: boolean
  ): BillingInvoice => ({
    id,
    number: O.some(id),
    state: isOutstanding ? 'past_due' : 'paid',
    collectionMethod: O.some('automatic'),
    currency: O.some('GBP'),
    total: O.some(30),
    paid: O.some(isOutstanding ? 0 : 30),
    balance: O.some(isOutstanding ? 30 : 0),
    createdAt: at(createdAt),
    dueAt: at(createdAt),
    dunningEventsSent: O.none,
    isOutstanding,
    daysOverdue: O.none,
    issues: [],
    attempts: [],
  });

  it('shows nothing when the member is square with us', () => {
    expect(
      invoicesSinceFirstUnpaid([
        inv('a', '2026-09-01T00:00:00.000Z', false),
        inv('b', '2026-08-01T00:00:00.000Z', false),
      ])
    ).toEqual([]);
  });

  // The shape the trustees asked for: successes between failures, and between
  // the latest failure and now, but nothing from before the trouble began.
  it('keeps the payments made since the oldest thing still owed', () => {
    const invoices = [
      inv('sep-failed', '2026-09-01T00:00:00.000Z', true),
      inv('aug-paid', '2026-08-15T00:00:00.000Z', false),
      inv('aug-failed', '2026-08-01T00:00:00.000Z', true),
      inv('jul-paid', '2026-07-01T00:00:00.000Z', false),
      inv('jun-paid', '2026-06-01T00:00:00.000Z', false),
    ];
    expect(invoicesSinceFirstUnpaid(invoices).map(i => i.id)).toEqual([
      'sep-failed',
      'aug-paid',
      'aug-failed',
    ]);
  });

  it('keeps an unpaid invoice even if it predates every other one', () => {
    const invoices = [
      inv('new-paid', '2026-09-01T00:00:00.000Z', false),
      inv('old-failed', '2026-01-01T00:00:00.000Z', true),
    ];
    expect(invoicesSinceFirstUnpaid(invoices).map(i => i.id)).toEqual([
      'new-paid',
      'old-failed',
    ]);
  });

  it('keeps the order it was given', () => {
    const invoices = [
      inv('c', '2026-09-01T00:00:00.000Z', true),
      inv('b', '2026-08-01T00:00:00.000Z', false),
      inv('a', '2026-07-01T00:00:00.000Z', true),
    ];
    expect(invoicesSinceFirstUnpaid(invoices).map(i => i.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });
});
