import {createClient} from '@libsql/client';
import {
  ensureExtDBTablesExist,
  ExternalStateDB,
  initExternalStateDB,
} from '../../../src/sync-worker/external-state-db';
import {gmailMessageTable} from '../../../src/sync-worker/gmail/gmail-message-table';
import {
  countFilteredConversations,
  getInboxThreads,
} from '../../../src/read-models/external-state/gmail-inbox';

// One Amazon notice as the mailbox actually held it: delivered by two groups,
// so it is cached twice, and only the copy imported after X-Original-Sender
// was first stored carries the header. The subjects differ only by the tag
// the second group added, so both copies land in one conversation - and a
// conversation is hidden only when every message in it matches. A rule that
// could read nothing but the header therefore left the notice on the page,
// whichever copy it looked at.
//
// Both copies carry the same From, because a group rewrites it: the supplier
// survives only in the display name.
const GROUP_FROM = `"'Amazon.co.uk' via management" <management@makespace.org>`;
const RECEIVED = new Date('2026-09-23T06:16:50.000Z');

const copy = (over: Record<string, unknown>) => ({
  mailbox: 'tickets@makespace.org',
  to_addresses: 'management@makespace.org',
  from_address: GROUP_FROM,
  received_at: RECEIVED,
  snippet: 'Delivery estimate update',
  body_text: 'Your parcel is on the way.',
  body_html: null,
  attachments_json: '[]',
  label_ids: '[]',
  cached_at: RECEIVED,
  ...over,
});

const withoutHeader = (rfc822MessageId: string) =>
  copy({
    gmail_message_id: 'copy-without-header',
    gmail_thread_id: 'thread-a',
    rfc822_message_id: rfc822MessageId,
    reply_to: null,
    original_sender: null,
    subject: '[Management] Delivery estimate update for your Amazon order',
  });

const withHeader = (rfc822MessageId: string) =>
  copy({
    gmail_message_id: 'copy-with-header',
    gmail_thread_id: 'thread-b',
    rfc822_message_id: rfc822MessageId,
    reply_to: '"Amazon.co.uk" <no-reply@amazon.co.uk>',
    original_sender: 'no-reply@amazon.co.uk',
    subject:
      '[admin] [Management] Delivery estimate update for your Amazon order',
  });

describe('an Amazon notice delivered by two groups', () => {
  let extDB: ExternalStateDB;
  let client: ReturnType<typeof createClient>;

  const cache = async (copies: ReadonlyArray<ReturnType<typeof copy>>) => {
    client = createClient({url: ':memory:'});
    extDB = initExternalStateDB(client);
    await ensureExtDBTablesExist(extDB)();
    await extDB.insert(gmailMessageTable).values(copies as never);
  };

  afterEach(() => {
    client.close();
  });

  // Whether the two copies share a Message-ID decides whether one is dropped
  // as a duplicate or both are grouped, so the rule has to hold either way.
  it('is hidden when the copies share a Message-ID and one is dropped', async () => {
    await cache([
      withoutHeader('<shared@amazon.co.uk>'),
      withHeader('<shared@amazon.co.uk>'),
    ]);

    expect(await getInboxThreads(extDB, 50)).toHaveLength(0);
    expect(await countFilteredConversations(extDB)).toBe(1);
  });

  it('is hidden when the copies are grouped into one conversation', async () => {
    await cache([
      withoutHeader('<first@amazon.co.uk>'),
      withHeader('<second@amazon.co.uk>'),
    ]);

    const [conversation] = await getInboxThreads(extDB, 50, {
      includeFiltered: true,
    });

    expect(conversation.messageCount).toBe(2);
    expect(conversation.filteredBy?.id).toBe('amazon-order-updates');
    expect(await getInboxThreads(extDB, 50)).toHaveLength(0);
    expect(await countFilteredConversations(extDB)).toBe(1);
  });

  // The copy with no header is the one that used to unhide the pair.
  it('is hidden even when no copy carries the header at all', async () => {
    await cache([withoutHeader('<only@amazon.co.uk>')]);

    expect(await countFilteredConversations(extDB)).toBe(1);
  });
});
