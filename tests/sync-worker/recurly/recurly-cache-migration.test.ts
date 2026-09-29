import {createClient} from '@libsql/client';
import {sql} from 'drizzle-orm';
import {
  ensureExtDBTablesExist,
  ExternalStateDB,
  initExternalStateDB,
} from '../../../src/sync-worker/external-state-db';
import {recurlySubscriptionTable} from '../../../src/sync-worker/recurly/recurly-data-table';

// The Recurly cache is persistent, so CREATE TABLE IF NOT EXISTS silently does
// nothing once it exists: accountId, added to the schema later, never reaches a
// database created before it, and every query selecting it fails. This
// reproduces that by building the old table shape first.
describe('the recurly cache picking up new columns', () => {
  let extDB: ExternalStateDB;
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient({url: ':memory:'});
    extDB = initExternalStateDB(client);
  });

  afterEach(() => {
    client.close();
  });

  it('adds accountId to a cache created by an older version', async () => {
    await extDB.run(
      sql`CREATE TABLE recurly_subscriptions (
        email TEXT PRIMARY KEY,
        cacheLastUpdated INTEGER NOT NULL,
        hasActiveSubscription INTEGER NOT NULL,
        hasFutureSubscription INTEGER NOT NULL,
        hasCanceledSubscription INTEGER NOT NULL,
        hasPausedSubscription INTEGER NOT NULL,
        hasPastDueInvoice INTEGER NOT NULL
      );`
    );
    await extDB.run(
      sql`INSERT INTO recurly_subscriptions VALUES (
        'old@example.com', 1756000000000, 1, 0, 0, 0, 0
      );`
    );

    await ensureExtDBTablesExist(extDB)();

    const rows = await extDB.select().from(recurlySubscriptionTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: 'old@example.com',
      accountId: null,
      hasActiveSubscription: true,
    });
  });

  it('is safe to run against a cache that is already up to date', async () => {
    await ensureExtDBTablesExist(extDB)();
    await expect(ensureExtDBTablesExist(extDB)()).resolves.not.toThrow();
  });
});
