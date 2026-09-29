import {createClient} from '@libsql/client';
import {sql} from 'drizzle-orm';
import {
  ensureExtDBTablesExist,
  ExternalStateDB,
  initExternalStateDB,
} from '../../../src/sync-worker/external-state-db';
import {
  recurlyInvoiceTable,
  recurlySubscriptionTable,
  recurlySyncMetadataTable,
} from '../../../src/sync-worker/recurly/recurly-data-table';

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

  it('rebuilds a billing cache that still insists on an email, and refetches it', async () => {
    // The shape shipped first time round: email was NOT NULL, so a record
    // Recurly gave us no address for could not be stored at all.
    await extDB.run(
      sql`CREATE TABLE recurly_invoices (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        accountId TEXT NOT NULL,
        state TEXT NOT NULL,
        cachedAt INTEGER NOT NULL
      );`
    );
    await extDB.run(
      sql`INSERT INTO recurly_invoices VALUES ('inv_old', 'old@example.com', 'acct_1', 'paid', 1756000000000);`
    );
    await extDB.run(
      sql`CREATE TABLE recurly_sync_metadata (
        resource TEXT PRIMARY KEY,
        cursor INTEGER NOT NULL
      );`
    );
    await extDB.run(
      sql`INSERT INTO recurly_sync_metadata VALUES ('invoices', 1756000000000);`
    );

    await ensureExtDBTablesExist(extDB)();

    // The old rows are gone, and so is the cursor - otherwise the next pull
    // would start from today and leave a hole where they used to be.
    expect(await extDB.select().from(recurlyInvoiceTable).all()).toHaveLength(0);
    expect(
      await extDB.select().from(recurlySyncMetadataTable).all()
    ).toHaveLength(0);

    // And the rebuilt table takes a row with nobody attached to it.
    await extDB
      .insert(recurlyInvoiceTable)
      .values({
        id: 'inv_new',
        email: null,
        accountId: 'acct_2',
        state: 'past_due',
        cachedAt: new Date(),
      })
      .run();
    const rows = await extDB.select().from(recurlyInvoiceTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBeNull();
  });

  it('rebuilds only once, leaving a migrated cache alone next boot', async () => {
    await ensureExtDBTablesExist(extDB)();
    await extDB
      .insert(recurlyInvoiceTable)
      .values({
        id: 'inv_1',
        email: 'payer@example.com',
        accountId: 'acct_1',
        state: 'paid',
        cachedAt: new Date(),
      })
      .run();

    await ensureExtDBTablesExist(extDB)();

    expect(await extDB.select().from(recurlyInvoiceTable).all()).toHaveLength(1);
  });
});
