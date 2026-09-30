import {createClient, Client} from '@libsql/client';
import * as O from 'fp-ts/Option';
import {
  ensureExtDBTablesExist,
  ExternalStateDB,
  initExternalStateDB,
} from '../../../src/sync-worker/external-state-db';
import {
  recurlyInvoiceTable,
  recurlySubscriptionTable,
} from '../../../src/sync-worker/recurly/recurly-data-table';
import {getBillingOverview} from '../../../src/read-models/external-state/billing-overview';
import {EmailAddress} from '../../../src/types';

const NOW = new Date('2026-09-30T12:00:00.000Z');

const memberWith = (memberNumber: number, email: string) => ({
  memberNumber,
  name: O.some(`Member ${memberNumber}`),
  emails: [
    {
      emailAddress: email as EmailAddress,
      verifiedAt: O.some(new Date('2025-01-01T00:00:00.000Z')),
      addedAt: new Date('2025-01-01T00:00:00.000Z'),
      verificationLastSent: O.none,
    },
  ],
});

describe('the outstanding invoices overview', () => {
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

  const addInvoice = (over: Record<string, unknown>) =>
    extDB
      .insert(recurlyInvoiceTable)
      .values({
        id: 'inv',
        email: 'a@example.com',
        accountId: 'acct',
        state: 'past_due',
        currency: 'GBP',
        total: 30,
        paid: 0,
        balance: 30,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        dueAt: new Date('2026-08-01T00:00:00.000Z'),
        cachedAt: NOW,
        ...over,
      })
      .run();

  const addSubscription = (email: string, over: Record<string, unknown> = {}) =>
    extDB
      .insert(recurlySubscriptionTable)
      .values({
        email,
        cacheLastUpdated: NOW,
        hasActiveSubscription: true,
        hasFutureSubscription: false,
        hasCanceledSubscription: false,
        hasPausedSubscription: false,
        hasPastDueInvoice: false,
        ...over,
      })
      .run();

  it('counts the days from the oldest unpaid invoice', async () => {
    await addInvoice({id: 'i1', dueAt: new Date('2026-08-01T00:00:00.000Z')});
    await addInvoice({id: 'i2', dueAt: new Date('2026-09-20T00:00:00.000Z')});
    await addSubscription('a@example.com');

    const overview = await getBillingOverview(extDB)(
      [memberWith(1, 'a@example.com')],
      NOW
    );
    expect(overview.concerns).toHaveLength(1);
    expect(overview.concerns[0]?.kind).toBe('overdue');
    expect(overview.concerns[0]?.daysOverdue).toStrictEqual(O.some(60));
    expect(overview.concerns[0]?.totalOutstanding).toBe(60);
  });

  // A pause stops future billing; it does not clear an existing debt.
  it('separates a paused member who still owes from an ordinary debtor', async () => {
    await addInvoice({id: 'i1'});
    await addSubscription('a@example.com', {
      hasActiveSubscription: false,
      hasPausedSubscription: true,
    });

    const overview = await getBillingOverview(extDB)(
      [memberWith(1, 'a@example.com')],
      NOW
    );
    expect(overview.concerns[0]?.kind).toBe('paused-owing');
  });

  it('ignores a voided invoice however its balance reads', async () => {
    await addInvoice({id: 'i1', state: 'voided'});
    await addSubscription('a@example.com');

    const overview = await getBillingOverview(extDB)(
      [memberWith(1, 'a@example.com')],
      NOW
    );
    expect(overview.concerns).toHaveLength(0);
  });

  // The gap an invoice-only view has: no live subscription raises no invoice.
  it('finds a member who has simply stopped paying', async () => {
    await addInvoice({
      id: 'i1',
      balance: 0,
      paid: 30,
      state: 'paid',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    await addSubscription('a@example.com', {hasActiveSubscription: false});

    const overview = await getBillingOverview(extDB)(
      [memberWith(1, 'a@example.com')],
      NOW
    );
    expect(overview.concerns[0]?.kind).toBe('lapsed');
  });

  it('leaves somebody who left years ago alone', async () => {
    await addInvoice({
      id: 'i1',
      balance: 0,
      paid: 30,
      state: 'paid',
      createdAt: new Date('2023-01-01T00:00:00.000Z'),
    });
    await addSubscription('a@example.com', {hasActiveSubscription: false});

    const overview = await getBillingOverview(extDB)(
      [memberWith(1, 'a@example.com')],
      NOW
    );
    expect(overview.concerns).toHaveLength(0);
  });

  it('says nothing about a member in good standing', async () => {
    await addInvoice({id: 'i1', balance: 0, paid: 30, state: 'paid'});
    await addSubscription('a@example.com');

    const overview = await getBillingOverview(extDB)(
      [memberWith(1, 'a@example.com')],
      NOW
    );
    expect(overview.concerns).toHaveLength(0);
  });

  // Otherwise these escape the process: nobody reads Recurly directly.
  it('reports money owed by an address matching no member', async () => {
    await addInvoice({id: 'i1', email: 'stranger@example.com'});

    const overview = await getBillingOverview(extDB)(
      [memberWith(1, 'a@example.com')],
      NOW
    );
    expect(overview.concerns).toHaveLength(0);
    expect(overview.unlinked).toHaveLength(1);
    expect(overview.unlinked[0]?.email).toBe('stranger@example.com');
  });

  it('matches a member whatever case the address was recorded in', async () => {
    await addInvoice({id: 'i1', email: 'A@Example.com'});
    await addSubscription('a@example.com');

    const overview = await getBillingOverview(extDB)(
      [memberWith(1, 'a@example.com')],
      NOW
    );
    expect(overview.concerns).toHaveLength(1);
    expect(overview.unlinked).toHaveLength(0);
  });

  it('calls a cache nobody has refreshed stale', async () => {
    await addInvoice({
      id: 'i1',
      cachedAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    const overview = await getBillingOverview(extDB)(
      [memberWith(1, 'a@example.com')],
      NOW
    );
    expect(overview.isStale).toBe(true);
  });

  it('does not call a cache refreshed this morning stale', async () => {
    await addInvoice({id: 'i1', cachedAt: NOW});
    const overview = await getBillingOverview(extDB)(
      [memberWith(1, 'a@example.com')],
      NOW
    );
    expect(overview.isStale).toBe(false);
  });
});
