import {createClient, Client} from '@libsql/client';
import createLogger from 'pino';
import {Duration} from 'luxon';
import {eq} from 'drizzle-orm';
import {
  ensureExtDBTablesExist,
  ExternalStateDB,
  initExternalStateDB,
} from '../../../src/sync-worker/external-state-db';
import {pullRecurlyData} from '../../../src/sync-worker/recurly/pull-recurly-data';
import type {RecurlyClientFactory} from '../../../src/sync-worker/recurly/pull-recurly-data';
import {
  recurlyInvoiceTable,
  recurlySubscriptionHistoryTable,
  recurlySubscriptionTable,
  recurlySyncMetadataTable,
  recurlyTransactionTable,
} from '../../../src/sync-worker/recurly/recurly-data-table';
import {EmailAddress} from '../../../src/types/email-address';

type RecurlyTestAccount = {
  id?: string | null;
  email: string;
  hasActiveSubscription?: boolean | null;
  hasFutureSubscription?: boolean | null;
  hasCanceledSubscription?: boolean | null;
  hasPausedSubscription?: boolean | null;
  hasPastDueInvoice?: boolean | null;
};

type RecurlyTestInvoice = {
  id?: string | null;
  account?: {id?: string | null; email?: string | null} | null;
  number?: string | null;
  state?: string | null;
  collectionMethod?: string | null;
  currency?: string | null;
  total?: number | null;
  paid?: number | null;
  balance?: number | null;
  createdAt?: Date | null;
  dueAt?: Date | null;
  closedAt?: Date | null;
  dunningEventsSent?: number | null;
  finalDunningEvent?: boolean | null;
  subscriptionIds?: string[] | null;
  updatedAt?: Date | null;
};

type RecurlyTestTransaction = {
  id?: string | null;
  account?: {id?: string | null; email?: string | null} | null;
  invoice?: {id?: string | null} | null;
  type?: string | null;
  status?: string | null;
  success?: boolean | null;
  refunded?: boolean | null;
  amount?: number | null;
  currency?: string | null;
  createdAt?: Date | null;
  collectedAt?: Date | null;
  updatedAt?: Date | null;
  paymentMethod?: {
    cardType?: string | null;
    lastFour?: string | null;
    expMonth?: number | null;
    expYear?: number | null;
  } | null;
  statusMessage?: string | null;
  customerMessage?: string | null;
  gatewayMessage?: string | null;
  merchantReasonCode?: string | null;
};

async function* iterate<T>(rows: ReadonlyArray<T>) {
  for (const row of rows) {
    yield row;
  }
}

type RecurlyTestSubscription = {
  id?: string | null;
  account?: {id?: string | null; email?: string | null} | null;
  plan?: {code?: string | null} | null;
  state?: string | null;
  activatedAt?: Date | null;
  canceledAt?: Date | null;
  expiresAt?: Date | null;
  currentPeriodEndsAt?: Date | null;
  updatedAt?: Date | null;
};

type RecurlyTestData = {
  accounts?: ReadonlyArray<RecurlyTestAccount>;
  invoices?: ReadonlyArray<RecurlyTestInvoice>;
  transactions?: ReadonlyArray<RecurlyTestTransaction>;
  subscriptions?: ReadonlyArray<RecurlyTestSubscription>;
};

// What pullRecurlyData passes to the list endpoints, so a test can assert on
// the window it asked Recurly for.
type ListOptions = {params: {beginTime?: Date}};

type Page<T> = {each: () => AsyncGenerator<T, void, unknown>};

type RecurlyTestMocks = {
  listAccounts: jest.Mock<Page<RecurlyTestAccount>, []>;
  listInvoices: jest.Mock<Page<RecurlyTestInvoice>, [object?]>;
  listTransactions: jest.Mock<Page<RecurlyTestTransaction>, [object?]>;
  listSubscriptions: jest.Mock<Page<RecurlyTestSubscription>, [object?]>;
};

// The list endpoints take a bag of url parameters, so reading one back out is
// the single place a test has to say what shape it expects.
const beginTimeOf = (call: [object?] | undefined): Date | undefined =>
  (call?.[0] as ListOptions | undefined)?.params.beginTime;

const recurlyClientFactory = (
  data: RecurlyTestData | ReadonlyArray<RecurlyTestAccount>
): [RecurlyClientFactory, RecurlyTestMocks] => {
  const {
    accounts = [],
    invoices = [],
    transactions = [],
    subscriptions = [],
  } = Array.isArray(data)
    ? {accounts: data as ReadonlyArray<RecurlyTestAccount>}
    : (data as RecurlyTestData);
  const mocks: RecurlyTestMocks = {
    listAccounts: jest.fn(() => ({each: () => iterate(accounts)})),
    listInvoices: jest.fn(() => ({each: () => iterate(invoices)})),
    listTransactions: jest.fn(() => ({each: () => iterate(transactions)})),
    listSubscriptions: jest.fn(() => ({each: () => iterate(subscriptions)})),
  };
  return [jest.fn(() => mocks), mocks];
};

describe('pull recurly data', () => {
  let extDBClient: Client;
  let extDB: ExternalStateDB;
  beforeEach(async () => {
    extDBClient = createClient({url: ':memory:'});
    extDB = initExternalStateDB(extDBClient);
    await ensureExtDBTablesExist(extDB)();
  });
  afterEach(() => {
    extDBClient.close();
  });

  it('pulls Recurly account status fields into the subscription cache', async () => {
    const [createRecurlyClient] = recurlyClientFactory([
      {
        email: 'active@example.com',
        hasActiveSubscription: true,
        hasFutureSubscription: true,
        hasCanceledSubscription: false,
        hasPausedSubscription: true,
        hasPastDueInvoice: false,
      },
      {
        email: 'not an email',
        hasActiveSubscription: true,
      },
    ]);

    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    )(Duration.fromMillis(0));

    expect(createRecurlyClient).toHaveBeenCalledWith('token');
    const rows = await extDB.select().from(recurlySubscriptionTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.cacheLastUpdated).toBeInstanceOf(Date);
    expect(rows[0]).toMatchObject({
      email: 'active@example.com',
      hasActiveSubscription: true,
      hasFutureSubscription: true,
      hasCanceledSubscription: false,
      hasPausedSubscription: true,
      hasPastDueInvoice: false,
    });
  });

  it('defaults missing Recurly status fields to false', async () => {
    const [createRecurlyClient] = recurlyClientFactory([
      {email: 'missing@example.com'},
    ]);

    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    )(Duration.fromMillis(0));

    const row = await extDB
      .select()
      .from(recurlySubscriptionTable)
      .where(eq(recurlySubscriptionTable.email, 'missing@example.com'))
      .get();
    expect(row?.cacheLastUpdated).toBeInstanceOf(Date);
    expect(row).toMatchObject({
      email: 'missing@example.com',
      hasActiveSubscription: false,
      hasFutureSubscription: false,
      hasCanceledSubscription: false,
      hasPausedSubscription: false,
      hasPastDueInvoice: false,
    });
  });

  it('stores mixed-case Recurly emails lowercased', async () => {
    const [createRecurlyClient] = recurlyClientFactory([
      {
        email: 'MixedCase@Example.com',
        hasActiveSubscription: true,
      },
    ]);

    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    )(Duration.fromMillis(0));

    const rows = await extDB.select().from(recurlySubscriptionTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: 'mixedcase@example.com',
      hasActiveSubscription: true,
    });
  });

  it('updates an existing cached subscription row', async () => {
    const email = 'existing@example.com' as EmailAddress;
    await extDB
      .insert(recurlySubscriptionTable)
      .values({
        email,
        cacheLastUpdated: new Date('2026-01-01T00:00:00.000Z'),
        hasActiveSubscription: false,
        hasFutureSubscription: false,
        hasCanceledSubscription: true,
        hasPausedSubscription: false,
        hasPastDueInvoice: true,
      })
      .run();
    const [createRecurlyClient] = recurlyClientFactory([
      {
        email,
        hasActiveSubscription: true,
        hasFutureSubscription: false,
        hasCanceledSubscription: false,
        hasPausedSubscription: false,
        hasPastDueInvoice: false,
      },
    ]);

    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    )(Duration.fromMillis(0));

    const row = await extDB
      .select()
      .from(recurlySubscriptionTable)
      .where(eq(recurlySubscriptionTable.email, email))
      .get();
    expect(row?.cacheLastUpdated).toBeInstanceOf(Date);
    expect(row).toMatchObject({
      email,
      hasActiveSubscription: true,
      hasFutureSubscription: false,
      hasCanceledSubscription: false,
      hasPausedSubscription: false,
      hasPastDueInvoice: false,
    });
  });

  it('skips pulling again before the requested sync interval has elapsed', async () => {
    const [createRecurlyClient, mocks] = recurlyClientFactory([]);
    const pull = pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    );

    await pull(Duration.fromMillis(1000));
    await pull(Duration.fromMillis(1000));

    expect(mocks.listAccounts).toHaveBeenCalledTimes(1);
  });

  it('records the Recurly account id alongside the subscription flags', async () => {
    const [createRecurlyClient] = recurlyClientFactory([
      {id: 'acct_1', email: 'withid@example.com'},
    ]);

    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    )(Duration.fromMillis(0));

    const row = await extDB
      .select()
      .from(recurlySubscriptionTable)
      .where(eq(recurlySubscriptionTable.email, 'withid@example.com'))
      .get();
    expect(row?.accountId).toBe('acct_1');
  });

  it('caches invoices against the lowercased account email', async () => {
    const [createRecurlyClient] = recurlyClientFactory({
      invoices: [
        {
          id: 'inv_1',
          account: {id: 'acct_1', email: 'Payer@Example.com'},
          number: '1234',
          state: 'past_due',
          collectionMethod: 'automatic',
          currency: 'GBP',
          total: 25,
          paid: 0,
          balance: 25,
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          dueAt: new Date('2026-08-01T00:00:00.000Z'),
          dunningEventsSent: 2,
          finalDunningEvent: false,
          subscriptionIds: ['sub_1'],
          updatedAt: new Date('2026-08-05T00:00:00.000Z'),
        },
      ],
    });

    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    )(Duration.fromMillis(0));

    const rows = await extDB.select().from(recurlyInvoiceTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.cachedAt).toBeInstanceOf(Date);
    expect(rows[0]).toMatchObject({
      id: 'inv_1',
      email: 'payer@example.com',
      accountId: 'acct_1',
      number: '1234',
      state: 'past_due',
      collectionMethod: 'automatic',
      balance: 25,
      dunningEventsSent: 2,
      finalDunningEvent: false,
      subscriptionIds: '["sub_1"]',
    });
    expect(rows[0]?.dueAt).toEqual(new Date('2026-08-01T00:00:00.000Z'));
  });

  it('keeps invoices whose account email is missing or unusable', async () => {
    const [createRecurlyClient] = recurlyClientFactory({
      invoices: [
        {id: 'inv_1', account: {id: 'acct_1', email: 'not an email'}, state: 'open'},
        {id: 'inv_2', account: {id: 'acct_2'}, state: 'open'},
      ],
    });

    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    )(Duration.fromMillis(0));

    // Dropping these would lose the billing history and hide the gap.
    const rows = await extDB.select().from(recurlyInvoiceTable).all();
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.email)).toEqual([null, null]);
    expect(rows.map(row => row.accountId)).toEqual(['acct_1', 'acct_2']);
  });

  it('matches an invoice to its member by account id when Recurly gave no address', async () => {
    const [createRecurlyClient] = recurlyClientFactory({
      accounts: [{id: 'acct_1', email: 'payer@example.com'}],
      invoices: [{id: 'inv_1', account: {id: 'acct_1'}, state: 'past_due'}],
    });

    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    )(Duration.fromMillis(0));

    const row = await extDB
      .select()
      .from(recurlyInvoiceTable)
      .where(eq(recurlyInvoiceTable.id, 'inv_1'))
      .get();
    expect(row?.email).toBe('payer@example.com');
  });

  it('matches a transaction to its member through the invoice it paid', async () => {
    const [createRecurlyClient] = recurlyClientFactory({
      invoices: [
        {
          id: 'inv_1',
          account: {id: 'acct_1', email: 'payer@example.com'},
          state: 'past_due',
        },
      ],
      // No account on the transaction at all - only the invoice it belongs to.
      transactions: [{id: 'tx_1', invoice: {id: 'inv_1'}, status: 'declined'}],
    });

    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    )(Duration.fromMillis(0));

    const row = await extDB
      .select()
      .from(recurlyTransactionTable)
      .where(eq(recurlyTransactionTable.id, 'tx_1'))
      .get();
    expect(row?.email).toBe('payer@example.com');
  });

  it('matches up rows left over from an earlier pull once the account arrives', async () => {
    // The invoice turns up before anything knows whose account it is.
    const [firstClient] = recurlyClientFactory({
      invoices: [{id: 'inv_1', account: {id: 'acct_1'}, state: 'past_due'}],
    });
    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      firstClient
    )(Duration.fromMillis(0));
    const before = await extDB
      .select()
      .from(recurlyInvoiceTable)
      .where(eq(recurlyInvoiceTable.id, 'inv_1'))
      .get();
    expect(before?.email).toBeNull();

    // A later cycle sees the account, and the old row is picked up even though
    // the invoice itself was not fetched again.
    const [secondClient] = recurlyClientFactory({
      accounts: [{id: 'acct_1', email: 'payer@example.com'}],
    });
    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      secondClient
    )(Duration.fromMillis(0));

    const after = await extDB
      .select()
      .from(recurlyInvoiceTable)
      .where(eq(recurlyInvoiceTable.id, 'inv_1'))
      .get();
    expect(after?.email).toBe('payer@example.com');
  });

  it('leaves a genuinely unmatchable row alone rather than guessing', async () => {
    const [createRecurlyClient] = recurlyClientFactory({
      accounts: [{id: 'acct_other', email: 'somebody@example.com'}],
      transactions: [{id: 'tx_1', account: {id: 'acct_unknown'}, status: 'declined'}],
    });

    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    )(Duration.fromMillis(0));

    const row = await extDB
      .select()
      .from(recurlyTransactionTable)
      .where(eq(recurlyTransactionTable.id, 'tx_1'))
      .get();
    expect(row?.email).toBeNull();
    expect(row?.accountId).toBe('acct_unknown');
  });

  it('caches the payment attempt behind an unpaid invoice, card expiry included', async () => {
    const [createRecurlyClient] = recurlyClientFactory({
      transactions: [
        {
          id: 'tx_1',
          account: {id: 'acct_1', email: 'payer@example.com'},
          invoice: {id: 'inv_1'},
          type: 'purchase',
          status: 'declined',
          success: false,
          amount: 25,
          currency: 'GBP',
          createdAt: new Date('2026-08-02T00:00:00.000Z'),
          collectedAt: null,
          paymentMethod: {
            cardType: 'Visa',
            lastFour: '4242',
            expMonth: 4,
            expYear: 2026,
          },
          statusMessage: 'The card is expired.',
          customerMessage: 'Your card has expired.',
          gatewayMessage: 'expired_card',
          merchantReasonCode: '1001',
          updatedAt: new Date('2026-08-02T00:00:00.000Z'),
        },
      ],
    });

    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    )(Duration.fromMillis(0));

    const rows = await extDB.select().from(recurlyTransactionTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'tx_1',
      invoiceId: 'inv_1',
      email: 'payer@example.com',
      status: 'declined',
      success: false,
      cardType: 'Visa',
      lastFour: '4242',
      expMonth: 4,
      expYear: 2026,
      statusMessage: 'The card is expired.',
      gatewayMessage: 'expired_card',
    });
    expect(rows[0]?.collectedAt).toBeNull();
  });

  it('asks Recurly only for what changed since the last pull', async () => {
    const [createRecurlyClient, mocks] = recurlyClientFactory({
      invoices: [
        {
          id: 'inv_1',
          account: {id: 'acct_1', email: 'payer@example.com'},
          state: 'paid',
          updatedAt: new Date('2026-08-05T12:00:00.000Z'),
        },
      ],
    });
    const pull = pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    );

    await pull(Duration.fromMillis(0));

    // First call reaches back over the backfill window.
    const firstBeginTime = beginTimeOf(mocks.listInvoices.mock.calls[0]);
    expect(firstBeginTime?.getTime()).toBeLessThan(
      new Date('2026-08-05T12:00:00.000Z').getTime()
    );

    await pull(Duration.fromMillis(0));

    // Second picks up from the newest record seen, less the overlap.
    const secondBeginTime = beginTimeOf(mocks.listInvoices.mock.calls[1]);
    expect(secondBeginTime).toEqual(new Date('2026-08-05T11:55:00.000Z'));
  });

  it('never walks the cursor backwards when nothing has changed', async () => {
    const [createRecurlyClient] = recurlyClientFactory({
      invoices: [
        {
          id: 'inv_1',
          account: {id: 'acct_1', email: 'payer@example.com'},
          state: 'paid',
          updatedAt: new Date('2026-08-05T12:00:00.000Z'),
        },
      ],
    });
    const pull = pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    );
    await pull(Duration.fromMillis(0));
    const afterFirst = await extDB
      .select()
      .from(recurlySyncMetadataTable)
      .where(eq(recurlySyncMetadataTable.resource, 'invoices'))
      .get();

    // The same record comes back inside the overlap window, again and again.
    await pull(Duration.fromMillis(0));
    await pull(Duration.fromMillis(0));

    const afterThird = await extDB
      .select()
      .from(recurlySyncMetadataTable)
      .where(eq(recurlySyncMetadataTable.resource, 'invoices'))
      .get();
    expect(afterThird?.cursor).toEqual(afterFirst?.cursor);
  });

  it('updates an invoice already in the cache rather than duplicating it', async () => {
    const invoice = {
      id: 'inv_1',
      account: {id: 'acct_1', email: 'payer@example.com'},
      state: 'past_due',
      balance: 25,
      updatedAt: new Date('2026-08-05T12:00:00.000Z'),
    };
    const [firstClient] = recurlyClientFactory({invoices: [invoice]});
    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      firstClient
    )(Duration.fromMillis(0));

    const [secondClient] = recurlyClientFactory({
      invoices: [{...invoice, state: 'paid', balance: 0}],
    });
    await pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      secondClient
    )(Duration.fromMillis(0));

    const rows = await extDB.select().from(recurlyInvoiceTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({id: 'inv_1', state: 'paid', balance: 0});
  });

  describe('subscription history', () => {
    const expired: RecurlyTestSubscription = {
      id: 'sub_old',
      account: {id: 'acct_1', email: 'Returning@Example.com'},
      plan: {code: 'standard'},
      state: 'expired',
      activatedAt: new Date('2022-01-10T00:00:00.000Z'),
      canceledAt: new Date('2024-10-14T00:00:00.000Z'),
      expiresAt: new Date('2024-11-14T00:00:00.000Z'),
      updatedAt: new Date('2024-11-14T00:00:00.000Z'),
    };
    const live: RecurlyTestSubscription = {
      id: 'sub_new',
      account: {id: 'acct_1', email: 'Returning@Example.com'},
      plan: {code: 'standard'},
      state: 'active',
      activatedAt: new Date('2026-09-28T09:05:00.000Z'),
      currentPeriodEndsAt: new Date('2026-10-28T09:05:00.000Z'),
      updatedAt: new Date('2026-09-28T09:05:00.000Z'),
    };

    it('caches every subscription, expired ones included, by lowercased email', async () => {
      const [createRecurlyClient] = recurlyClientFactory({
        subscriptions: [expired, live],
      });

      await pullRecurlyData(
        createLogger({level: 'silent'}),
        extDB,
        'token',
        createRecurlyClient
      )(Duration.fromMillis(0));

      const rows = await extDB
        .select()
        .from(recurlySubscriptionHistoryTable)
        .orderBy(recurlySubscriptionHistoryTable.id)
        .all();
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        id: 'sub_new',
        email: 'returning@example.com',
        accountId: 'acct_1',
        state: 'active',
        planCode: 'standard',
        activatedAt: live.activatedAt,
        expiresAt: null,
      });
      expect(rows[1]).toMatchObject({
        id: 'sub_old',
        email: 'returning@example.com',
        state: 'expired',
        canceledAt: expired.canceledAt,
        expiresAt: expired.expiresAt,
      });
    });

    it('takes the whole history on the first pull rather than the billing backfill window', async () => {
      const [createRecurlyClient, mocks] = recurlyClientFactory({
        subscriptions: [expired],
      });
      const pull = pullRecurlyData(
        createLogger({level: 'silent'}),
        extDB,
        'token',
        createRecurlyClient
      );

      await pull(Duration.fromMillis(0));
      expect(beginTimeOf(mocks.listSubscriptions.mock.calls[0])).toBeUndefined();

      // And then only what has changed since, like the other resources.
      await pull(Duration.fromMillis(0));
      expect(beginTimeOf(mocks.listSubscriptions.mock.calls[1])).toEqual(
        new Date('2024-11-13T23:55:00.000Z')
      );
    });

    it('matches a subscription to its member by account id when Recurly gave no address', async () => {
      const [createRecurlyClient] = recurlyClientFactory({
        accounts: [{id: 'acct_1', email: 'returning@example.com'}],
        subscriptions: [{...expired, account: {id: 'acct_1', email: null}}],
      });

      await pullRecurlyData(
        createLogger({level: 'silent'}),
        extDB,
        'token',
        createRecurlyClient
      )(Duration.fromMillis(0));

      const row = await extDB
        .select()
        .from(recurlySubscriptionHistoryTable)
        .where(eq(recurlySubscriptionHistoryTable.id, 'sub_old'))
        .get();
      expect(row?.email).toStrictEqual('returning@example.com');
    });
  });
});
