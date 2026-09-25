import {createClient} from '@libsql/client';
import {
  ensureExtDBTablesExist,
  ExternalStateDB,
  initExternalStateDB,
} from '../../../src/sync-worker/external-state-db';
import {gmailMessageTable} from '../../../src/sync-worker/gmail/gmail-message-table';
import {
  countHiddenConversations,
  getInboxThreads,
} from '../../../src/read-models/external-state/gmail-inbox';
import {MailboxArchiveReason} from '../../../src/types/mailbox-archive-reason';

// Two conversations: one of two messages, one of one. A manager archives
// the first; the archive names both its message ids, and the page has to
// find it by either.
describe('archived conversations in the mailbox list', () => {
  let extDB: ExternalStateDB;
  let client: ReturnType<typeof createClient>;

  const row = (id: string, subject: string, receivedAt: string) => ({
    gmail_message_id: id,
    gmail_thread_id: `thread-${id}`,
    mailbox: 'tickets@example.org',
    rfc822_message_id: `<${id}@example.org>`,
    from_address: 'A Member <member@example.com>',
    to_addresses: 'management@example.org',
    subject,
    received_at: new Date(receivedAt),
    snippet: null,
    body_text: 'Hello',
    body_html: null,
    attachments_json: '[]',
    label_ids: '[]',
    cached_at: new Date(),
  });

  const archived = (...entries: Array<[string, MailboxArchiveReason]>) =>
    new Map<string, MailboxArchiveReason>(entries);

  beforeEach(async () => {
    client = createClient({url: ':memory:'});
    extDB = initExternalStateDB(client);
    await ensureExtDBTablesExist(extDB)();
    await extDB.insert(gmailMessageTable).values([
      row('wifi-1', 'Building wifi down', '2026-09-23T09:00:00.000Z'),
      row('wifi-2', 'Re: Building wifi down', '2026-09-23T10:00:00.000Z'),
      row('hire-1', 'Room hire enquiry', '2026-09-23T11:00:00.000Z'),
    ]);
  });

  afterEach(() => {
    client.close();
  });

  const subjects = (
    threads: ReadonlyArray<{latest: {subject: string | null}}>
  ) => threads.map(thread => thread.latest.subject);

  it('are left out of the list by default', async () => {
    const threads = await getInboxThreads(extDB, 50, {
      archived: archived(['wifi-1', 'resolved'], ['wifi-2', 'resolved']),
    });

    expect(subjects(threads)).toEqual(['Room hire enquiry']);
  });

  // The conversation's id is its earliest message, which drops out of the
  // cache window in time; the archive has to hold whichever message is left.
  it('are recognised by any one of their messages', async () => {
    const threads = await getInboxThreads(extDB, 50, {
      archived: archived(['wifi-2', 'resolved']),
    });

    expect(subjects(threads)).toEqual(['Room hire enquiry']);
  });

  it('are shown, with why, when asked for', async () => {
    const threads = await getInboxThreads(extDB, 50, {
      includeArchived: true,
      archived: archived(['wifi-1', 'hide-similar']),
    });

    expect(
      threads.map(thread => [thread.latest.subject, thread.archivedAs])
    ).toEqual([
      ['Room hire enquiry', undefined],
      ['Re: Building wifi down', 'hide-similar'],
    ]);
  });

  it('are counted for the page to say what the switch would reveal', async () => {
    expect(
      await countHiddenConversations(extDB, archived(['wifi-1', 'resolved']))
    ).toEqual({filtered: 0, archived: 1});
  });

  it('are nothing when nothing has been archived', async () => {
    expect(await getInboxThreads(extDB, 50)).toHaveLength(2);
    expect(await countHiddenConversations(extDB)).toEqual({
      filtered: 0,
      archived: 0,
    });
  });
});
