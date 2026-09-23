import {createClient} from '@libsql/client';
import {sql} from 'drizzle-orm';
import {
  ensureExtDBTablesExist,
  ExternalStateDB,
  initExternalStateDB,
} from '../../src/sync-worker/external-state-db';
import {getInboxThreads} from '../../src/read-models/external-state/gmail-inbox';

// The Gmail cache is persistent, so CREATE TABLE IF NOT EXISTS silently does
// nothing once it exists: a column added to the schema never reaches a
// database created before it, and every query selecting that column fails.
// This reproduces that by building the old table shape first.
describe('the gmail cache picking up new columns', () => {
  let extDB: ExternalStateDB;
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient({url: ':memory:'});
    extDB = initExternalStateDB(client);
  });

  afterEach(() => {
    client.close();
  });

  it('adds columns missing from a cache created by an older version', async () => {
    await extDB.run(
      sql`CREATE TABLE gmail_message (
        gmail_message_id TEXT PRIMARY KEY,
        gmail_thread_id TEXT NOT NULL,
        mailbox TEXT NOT NULL,
        rfc822_message_id TEXT,
        from_address TEXT,
        to_addresses TEXT,
        cc_addresses TEXT,
        subject TEXT,
        received_at INTEGER NOT NULL,
        snippet TEXT,
        body_text TEXT,
        body_html TEXT,
        attachments_json TEXT NOT NULL,
        label_ids TEXT NOT NULL,
        cached_at INTEGER NOT NULL
      );`
    );

    await ensureExtDBTablesExist(extDB)();

    // The query selects every column, so it throws if any are still missing.
    await expect(getInboxThreads(extDB, 10)).resolves.toEqual([]);
  });

  it('is safe to run again on an up-to-date cache', async () => {
    await ensureExtDBTablesExist(extDB)();
    await ensureExtDBTablesExist(extDB)();

    await expect(getInboxThreads(extDB, 10)).resolves.toEqual([]);
  });
});
