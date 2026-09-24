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
    // The sender's own id, which every group forwarding the message keeps.
    rfc822?: string;
  }) => {
    await extDB.insert(gmailMessageTable).values({
      gmail_message_id: input.id,
      gmail_thread_id: input.threadId,
      mailbox: 'tickets@makespace.org',
      rfc822_message_id: input.rfc822 ?? `<${input.id}@test>`,
      from_address: input.from,
      to_addresses: 'management@makespace.org',
      subject: input.subject,
      received_at: new Date(input.receivedAt),
      snippet: input.subject,
      body_text: `Body of ${input.id}`,
      body_html: '<p>Body</p>',
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
      from: 'alice@example.com',
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
    expect(threads.map(thread => thread.latest.gmailMessageId)).toEqual([
      'm2',
      'm3',
    ]);
  });

  // Google Groups re-sends each message, so a reply frequently arrives under
  // a different Gmail thread id from the message it answers - which is how
  // the Room Hire enquiry and its reply came in as two separate threads.
  it('groups a reply that Gmail filed under a different thread id', async () => {
    await addMessage({
      id: 'm4',
      threadId: 'different-thread-entirely',
      from: 'agent@example.com',
      subject: '[admin] Re: [Management] Room hire enquiry',
      receivedAt: '2026-09-23T11:07:00.000Z',
    });

    const threads = await getInboxThreads(extDB, 50);
    const roomHire = threads.find(thread =>
      thread.latest.subject?.toLowerCase().includes('room hire')
    );

    expect(roomHire?.messageCount).toBe(2);
    expect(threads).toHaveLength(2);
  });

  it('does not merge unrelated conversations that happen to share a subject', async () => {
    await addMessage({
      id: 'm5',
      threadId: 'much-later',
      from: 'someone-else@example.com',
      subject: 'Room hire enquiry',
      // Over a year later: a different enquiry that reuses the wording.
      receivedAt: '2027-11-01T09:00:00.000Z',
    });

    const threads = await getInboxThreads(extDB, 50);
    const roomHireConversations = threads.filter(thread =>
      thread.latest.subject?.toLowerCase().includes('room hire')
    );

    expect(roomHireConversations).toHaveLength(2);
    expect(roomHireConversations.every(thread => thread.messageCount === 1)).toBe(
      true
    );
  });

  it('orders conversations by their most recent reply', async () => {
    const [first] = await getInboxThreads(extDB, 50);

    // The wifi reply at 10:12 is newer than the room hire enquiry at 09:55,
    // even though the wifi thread started earlier.
    expect(first.latest.gmailMessageId).toBe('m2');
  });

  it('counts the messages and lists everyone who wrote, oldest first', async () => {
    const [withReply, single] = await getInboxThreads(extDB, 50);

    expect(withReply.messageCount).toBe(2);
    expect(withReply.senders).toEqual([
      'alice@example.com',
      'hector@example.com',
    ]);
    expect(single.messageCount).toBe(1);
  });

  // tickets@ is subscribed to several groups, so a message sent to more than
  // one arrives more than once: same Message-ID, different Gmail ids.
  it('shows one copy of a message delivered by two groups', async () => {
    await addMessage({
      id: 'm1-via-admin',
      threadId: 't-other',
      from: 'tara@example.com',
      subject: '[admin] Building wifi down',
      receivedAt: '2026-09-23T09:42:00.000Z',
      rfc822: '<m1@test>',
    });

    const threads = await getInboxThreads(extDB, 50);
    const wifi = threads.find(thread =>
      thread.latest.subject?.toLowerCase().includes('wifi')
    );

    // m1 and m1-via-admin are the same message; the reply makes two.
    expect(wifi?.messageCount).toBe(2);
  });

  it('reads a whole conversation oldest first, by its earliest message', async () => {
    const messages = await getInboxThread(extDB, 'm1');

    expect(messages.map(message => message.gmailMessageId)).toEqual([
      'm1',
      'm2',
    ]);
  });

  it('returns nothing for a conversation that does not exist', async () => {
    expect(await getInboxThread(extDB, 'nope')).toEqual([]);
  });
});

// The grouping reads a window of the cache rather than all of it. Taken from
// the wrong end that window is the mailbox's oldest messages, which froze the
// page: nothing new ever appeared and every new conversation was "No such
// conversation". The window has to follow the newest mail.
describe('a cache larger than the grouping window', () => {
  const GROUPING_WINDOW = 500;
  const MESSAGES = GROUPING_WINDOW + 100;
  const FIRST_RECEIVED_AT = new Date('2026-01-01T00:00:00.000Z').getTime();
  const newest = `m${MESSAGES - 1}`;

  let extDB: ExternalStateDB;
  let client: ReturnType<typeof createClient>;

  beforeEach(async () => {
    client = createClient({url: ':memory:'});
    extDB = initExternalStateDB(client);
    await ensureExtDBTablesExist(extDB)();

    // One conversation per message, an hour apart, oldest first.
    await extDB.insert(gmailMessageTable).values(
      Array.from({length: MESSAGES}, (_, index) => ({
        gmail_message_id: `m${index}`,
        gmail_thread_id: `t${index}`,
        mailbox: 'tickets@example.org',
        rfc822_message_id: `<m${index}@test>`,
        from_address: 'someone@example.com',
        to_addresses: 'management@example.org',
        subject: `Enquiry number ${index}`,
        received_at: new Date(FIRST_RECEIVED_AT + index * 60 * 60 * 1000),
        snippet: `Snippet ${index}`,
        body_text: `Body of m${index}`,
        body_html: null,
        attachments_json: '[]',
        label_ids: '[]',
        cached_at: new Date(),
      }))
    );
  });

  afterEach(() => {
    client.close();
  });

  it('lists the newest conversations, not the oldest', async () => {
    const threads = await getInboxThreads(extDB, 50);

    expect(threads[0].latest.gmailMessageId).toBe(newest);
  });

  it('reads a conversation that arrived after the first window filled', async () => {
    const messages = await getInboxThread(extDB, newest);

    expect(messages.map(message => message.gmailMessageId)).toEqual([newest]);
  });

  it('leaves the conversations that fell out of the window behind', async () => {
    expect(await getInboxThread(extDB, 'm0')).toEqual([]);
  });
});
