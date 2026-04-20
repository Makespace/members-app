import {createClient, Client} from '@libsql/client';
import createLogger from 'pino';
import {Duration} from 'luxon';
import {eq} from 'drizzle-orm';
import recurly from 'recurly';
import {
  ensureExtDBTablesExist,
  ExternalStateDB,
  initExternalStateDB,
} from '../../../src/sync-worker/external-state-db';
import {pullRecurlyData} from '../../../src/sync-worker/recurly/pull-recurly-data';
import {recurlySubscriptionTable} from '../../../src/sync-worker/recurly/recurly-data-table';
import {EmailAddress} from '../../../src/types/email-address';

jest.mock('recurly', () => ({
  __esModule: true,
  default: {
    Client: jest.fn(),
  },
}));

let mockEach: jest.Mock;
let mockListAccounts: jest.Mock;

const mockClient = recurly.Client as unknown as jest.Mock;

async function* accounts(
  rows: ReadonlyArray<{
    email: string;
    hasActiveSubscription?: boolean;
    hasFutureSubscription?: boolean;
    hasCanceledSubscription?: boolean;
    hasPausedSubscription?: boolean;
    hasPastDueInvoice?: boolean;
  }>
) {
  for (const row of rows) {
    yield row;
  }
}

describe('pull recurly data', () => {
  let extDBClient: Client;
  let extDB: ExternalStateDB;
  beforeEach(async () => {
    extDBClient = createClient({url: ':memory:'});
    extDB = initExternalStateDB(extDBClient);
    await ensureExtDBTablesExist(extDB)();
    mockEach = jest.fn();
    mockListAccounts = jest.fn(() => ({each: mockEach}));
    mockClient.mockReset();
    mockClient.mockImplementation(() => ({listAccounts: mockListAccounts}));
  });
  afterEach(() => {
    extDBClient.close();
  });

  it('pulls Recurly account status fields into the subscription cache', async () => {
    mockEach.mockReturnValue(accounts([
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
    ]));

    await pullRecurlyData(createLogger({level: 'silent'}), extDB, 'token')(
      Duration.fromMillis(0)
    );

    expect(mockClient).toHaveBeenCalledWith('token');
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
    mockEach.mockReturnValue(accounts([{email: 'missing@example.com'}]));

    await pullRecurlyData(createLogger({level: 'silent'}), extDB, 'token')(
      Duration.fromMillis(0)
    );

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
    mockEach.mockReturnValue(accounts([
      {
        email,
        hasActiveSubscription: true,
        hasFutureSubscription: false,
        hasCanceledSubscription: false,
        hasPausedSubscription: false,
        hasPastDueInvoice: false,
      },
    ]));

    await pullRecurlyData(createLogger({level: 'silent'}), extDB, 'token')(
      Duration.fromMillis(0)
    );

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
    mockEach.mockReturnValue(accounts([]));
    const pull = pullRecurlyData(createLogger({level: 'silent'}), extDB, 'token');

    await pull(Duration.fromMillis(1000));
    await pull(Duration.fromMillis(1000));

    expect(mockListAccounts).toHaveBeenCalledTimes(1);
  });
});
