import {createClient} from '@libsql/client';
import {
  ensureExtDBTablesExist,
  ExternalStateDB,
  initExternalStateDB,
} from '../../../src/sync-worker/external-state-db';
import {gmailMessageTable} from '../../../src/sync-worker/gmail/gmail-message-table';
import {
  getInboxThread,
  getInboxThreads,
} from '../../../src/read-models/external-state/gmail-inbox';

describe('grouping the mailbox into conversations', () => {
  let extDB: ExternalStateDB;
  let client: ReturnType<typeof createClient>;

  const addMessage = async (input: {
    id: string;
    threadId: string;
    from: string;
    subject: string;
    receivedAt: string;
  }) => {
    await extDB.insert(gmailMessageTable).values({
      gmail_message_id: input.id,
      gmail_thread_id: input.threadId,
      mailbox: 'tickets@makespace.org',
      rfc822_message_id: `<${input.id}@test>`,
      from_address: input.from,
      to_addresses: 'management@makespace.org',
      subject: input.subject,
      received_at: new Date(input.receivedAt),
      snippet: input.subject,
      body_text: `Body of ${input.id}`,
      body_html: null,
      attachments_json: '[]',
      label_ids: '[]',
      cached_at: new Date(),
    });
  };

  beforeEach(async () => {
    client = createClient({url: ':memory:'});
    extDB = initExternalStateDB(client);
    await ensureExtDBTablesExist(extDB)();

    await addMessage({
      id: 'm1',
      threadId: 't1',
      from: 'tara@example.com',
      subject: 'Building wifi down',
      receivedAt: '2026-09-23T09:42:00.000Z',
    });
    await addMessage({
      id: 'm2',
      threadId: 't1',
      from: 'hector@example.com',
      subject: 'Re: Building wifi down',
      receivedAt: '2026-09-23T10:12:00.000Z',
    });
    await addMessage({
      id: 'm3',
      threadId: 't2',
      from: 'someone@example.com',
      subject: 'Room hire enquiry',
      receivedAt: '2026-09-23T09:55:00.000Z',
    });
  });

  afterEach(() => {
    client.close();
  });

  it('shows one row per conversation, not per message', async () => {
    const threads = await getInboxThreads(extDB, 50);

    expect(threads).toHaveLength(2);
    expect(threads.map(thread => thread.gmailThreadId)).toEqual(['t1', 't2']);
  });

  it('orders conversations by their most recent reply', async () => {
    const [first] = await getInboxThreads(extDB, 50);

    // t1's reply at 10:12 is newer than t2's only message at 09:55, even
    // though t1 started earlier.
    expect(first.gmailThreadId).toBe('t1');
    expect(first.latest.gmailMessageId).toBe('m2');
  });

  it('counts the messages and lists everyone who wrote, oldest first', async () => {
    const [withReply, single] = await getInboxThreads(extDB, 50);

    expect(withReply.messageCount).toBe(2);
    expect(withReply.senders).toEqual([
      'tara@example.com',
      'hector@example.com',
    ]);
    expect(single.messageCount).toBe(1);
  });

  it('reads a whole conversation oldest first', async () => {
    const messages = await getInboxThread(extDB, 't1');

    expect(messages.map(message => message.gmailMessageId)).toEqual([
      'm1',
      'm2',
    ]);
  });

  it('returns nothing for a conversation that does not exist', async () => {
    expect(await getInboxThread(extDB, 'nope')).toEqual([]);
  });
});
