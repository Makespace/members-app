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
import {recurlySubscriptionTable} from '../../../src/sync-worker/recurly/recurly-data-table';
import {EmailAddress} from '../../../src/types/email-address';

type RecurlyTestAccount = {
  email: string;
  hasActiveSubscription?: boolean | null;
  hasFutureSubscription?: boolean | null;
  hasCanceledSubscription?: boolean | null;
  hasPausedSubscription?: boolean | null;
  hasPastDueInvoice?: boolean | null;
};

async function* accounts(
  rows: ReadonlyArray<RecurlyTestAccount>
) {
  for (const row of rows) {
    yield row;
  }
}

const recurlyClientFactory = (
  rows: ReadonlyArray<RecurlyTestAccount>
): [RecurlyClientFactory, jest.Mock] => {
  const listAccounts = jest.fn(() => ({
    each: () => accounts(rows),
  }));
  return [jest.fn(() => ({listAccounts})), listAccounts];
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
    const [createRecurlyClient, listAccounts] = recurlyClientFactory([]);
    const pull = pullRecurlyData(
      createLogger({level: 'silent'}),
      extDB,
      'token',
      createRecurlyClient
    );

    await pull(Duration.fromMillis(1000));
    await pull(Duration.fromMillis(1000));

    expect(listAccounts).toHaveBeenCalledTimes(1);
  });
});
