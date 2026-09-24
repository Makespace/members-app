import {createClient} from '@libsql/client';
import {
  ensureExtDBTablesExist,
  ExternalStateDB,
  initExternalStateDB,
} from '../../src/sync-worker/external-state-db';
import {
  GmailClient,
  pullGmailData,
} from '../../src/sync-worker/gmail/pull_gmail_data';
import {
  getInboxMessageById,
  getInboxMessages,
} from '../../src/read-models/external-state/gmail-inbox';
import {gmailMessageTable} from '../../src/sync-worker/gmail/gmail-message-table';
import {testLogger} from './util';

const b64 = (value: string) => Buffer.from(value, 'utf8').toString('base64url');

const apiMessage = (id: string, subject: string, to = 'management@makespace.org') => ({
  id,
  threadId: `thread-${id}`,
  snippet: `${subject}…`,
  internalDate: String(1789990000000 + Number(id.replace(/\D/g, '') || 0)),
  labelIds: ['INBOX'],
  payload: {
    mimeType: 'multipart/alternative',
    headers: [
      {name: 'From', value: 'member@example.com'},
      {name: 'To', value: to},
      {name: 'Subject', value: subject},
      {name: 'Message-ID', value: `<${id}@example.com>`},
    ],
    parts: [{mimeType: 'text/plain', body: {data: b64(`Body of ${id}`)}}],
  },
});

// A fake Gmail API: bootstrap serves `initial`, incremental serves `added`
// since the cursor; a 404 can be forced to test the expired-cursor fallback.
// `archived` can be fetched by id but never appears in a listing, as mail
// moved out of the inbox behaves; `gone` answers 404, as deleted mail does.
const fakeClient = (state: {
  historyId: string;
  initial: ReturnType<typeof apiMessage>[];
  added: ReturnType<typeof apiMessage>[];
  archived?: ReturnType<typeof apiMessage>[];
  gone?: string[];
  fetched?: string[];
  expireHistory?: boolean;
}): GmailClient => ({
  getProfile: () => Promise.resolve({historyId: state.historyId}),
  listMessageIds: () =>
    Promise.resolve({
      ids: [...state.initial, ...state.added].map(message => message.id),
    }),
  getMessage: id => {
    state.fetched?.push(id);
    if (state.gone?.includes(id)) {
      return Promise.reject(Object.assign(new Error('gone'), {code: 404}));
    }
    const found = [
      ...state.initial,
      ...state.added,
      ...(state.archived ?? []),
    ].find(message => message.id === id);
    if (!found) {
      return Promise.reject(new Error(`no such message ${id}`));
    }
    return Promise.resolve(found);
  },
  listHistoryMessageIds: () => {
    if (state.expireHistory) {
      return Promise.reject(Object.assign(new Error('expired'), {code: 404}));
    }
    return Promise.resolve({
      ids: state.added.map(message => message.id),
      historyId: state.historyId,
    });
  },
});

describe('pullGmailData', () => {
  let extDB: ExternalStateDB;
  let client: ReturnType<typeof createClient>;
  const mailbox = 'management@makespace.org';

  beforeEach(async () => {
    client = createClient({url: ':memory:'});
    extDB = initExternalStateDB(client);
    await ensureExtDBTablesExist(extDB)();
  });

  afterEach(() => {
    client.close();
  });

  it('bootstraps the full inbox, then pulls only new messages incrementally', async () => {
    const state = {
      historyId: 'h1',
      initial: [apiMessage('m1', 'First'), apiMessage('m2', 'Second')],
      added: [] as ReturnType<typeof apiMessage>[],
    };
    const factory = () => fakeClient(state);

    await pullGmailData(testLogger(), extDB, factory, mailbox, '');
    expect(await getInboxMessages(extDB, 50)).toHaveLength(2);

    state.added = [apiMessage('m3', 'Third')];
    state.historyId = 'h2';
    await pullGmailData(testLogger(), extDB, factory, mailbox, '');

    const messages = await getInboxMessages(extDB, 50);
    expect(messages).toHaveLength(3);
    expect(messages[0].subject).toBe('Third');
    const detail = await getInboxMessageById(extDB, 'm3');
    expect(detail?.bodyText).toBe('Body of m3');
  });

  it('re-imports without duplicates when the history cursor expires', async () => {
    const state = {
      historyId: 'h1',
      initial: [apiMessage('m1', 'First')],
      added: [] as ReturnType<typeof apiMessage>[],
      expireHistory: false,
    };
    const factory = () => fakeClient(state);
    await pullGmailData(testLogger(), extDB, factory, mailbox, '');

    state.expireHistory = true;
    state.added = [apiMessage('m2', 'Second')];
    await pullGmailData(testLogger(), extDB, factory, mailbox, '');

    const messages = await getInboxMessages(extDB, 50);
    expect(messages).toHaveLength(2);
  });

  it('caches replies to a thread it already has, even when they do not name the group', async () => {
    const state = {
      historyId: 'h1',
      initial: [apiMessage('m1', 'Building wifi down')],
      added: [] as ReturnType<typeof apiMessage>[],
    };
    const factory = () => fakeClient(state);
    const filter = 'management@makespace.org';

    await pullGmailData(testLogger(), extDB, factory, mailbox, filter);
    expect(await getInboxMessages(extDB, 50)).toHaveLength(1);

    // A reply addressed to a person, not the group - the shape that was
    // silently dropped before.
    const reply = apiMessage(
      'm2',
      'Re: Building wifi down',
      'hector@makespace.org'
    );
    reply.threadId = 'thread-m1';
    state.added = [reply];
    state.historyId = 'h2';

    await pullGmailData(testLogger(), extDB, factory, mailbox, filter);

    const messages = await getInboxMessages(extDB, 50);
    expect(messages.map(message => message.subject)).toEqual([
      'Re: Building wifi down',
      'Building wifi down',
    ]);
  });

  it('still ignores an unrelated thread that never names the group', async () => {
    const other = apiMessage('m9', 'Digest for safety-team', 'lists@example.com');
    other.threadId = 'thread-unrelated';
    const state = {
      historyId: 'h1',
      initial: [other],
      added: [] as ReturnType<typeof apiMessage>[],
    };
    const factory = () => fakeClient(state);

    await pullGmailData(
      testLogger(),
      extDB,
      factory,
      mailbox,
      'management@makespace.org'
    );

    expect(await getInboxMessages(extDB, 50)).toHaveLength(0);
  });

  it('only caches mail addressed to the filter address when one is set', async () => {
    const state = {
      historyId: 'h1',
      initial: [
        apiMessage('m1', 'For the group'),
        apiMessage('m2', 'IT business', 'it-owners@makespace.org'),
      ],
      added: [] as ReturnType<typeof apiMessage>[],
    };
    const factory = () => fakeClient(state);
    const filter = 'management@makespace.org';

    await pullGmailData(testLogger(), extDB, factory, mailbox, filter);
    expect((await getInboxMessages(extDB, 50)).map(m => m.subject)).toEqual([
      'For the group',
    ]);

    // Incremental additions are header-filtered too (history.list can't
    // filter server-side).
    state.added = [
      apiMessage('m3', 'Also for the group'),
      apiMessage('m4', 'More IT business', 'it-owners@makespace.org'),
    ];
    state.historyId = 'h2';
    await pullGmailData(testLogger(), extDB, factory, mailbox, filter);
    const messages = await getInboxMessages(extDB, 50);
    expect(messages.map(m => m.subject)).toEqual([
      'Also for the group',
      'For the group',
    ]);
  });

  // The cache once kept only a handful of named headers. A rule written
  // later than a row was imported could not read anything else about it,
  // and a re-list could not help: it covers the inbox, and the rows in
  // question had been archived out of it.
  describe('rows imported before every header was kept', () => {
    const staleRow = (id: string) =>
      extDB.insert(gmailMessageTable).values({
        gmail_message_id: id,
        gmail_thread_id: `thread-${id}`,
        mailbox,
        rfc822_message_id: `<${id}@example.com>`,
        from_address: `"'Amazon.co.uk' via management" <${mailbox}>`,
        to_addresses: mailbox,
        subject: 'Delivery estimate update',
        received_at: new Date('2026-09-23T06:16:50.000Z'),
        snippet: null,
        body_text: null,
        body_html: null,
        original_sender: null,
        headers_json: null,
        attachments_json: '[]',
        label_ids: '[]',
        cached_at: new Date('2026-09-23T06:20:29.000Z'),
      });

    it('are fetched again by id and rewritten in full, even once archived', async () => {
      await staleRow('old-1');
      const archived = apiMessage('old-1', 'Delivery estimate update');
      archived.payload.headers.push({
        name: 'X-Original-Sender',
        value: 'no-reply@amazon.co.uk',
      });
      const state = {
        historyId: 'h1',
        initial: [] as ReturnType<typeof apiMessage>[],
        added: [] as ReturnType<typeof apiMessage>[],
        archived: [archived],
        fetched: [] as string[],
      };
      const factory = () => fakeClient(state);

      await pullGmailData(testLogger(), extDB, factory, mailbox, '');

      const row = await getInboxMessageById(extDB, 'old-1');
      expect(row?.originalSender).toBe('no-reply@amazon.co.uk');
      expect(row?.headers).toContainEqual({
        name: 'X-Original-Sender',
        value: 'no-reply@amazon.co.uk',
      });

      // Once is enough: the next cycle has nothing left to refresh.
      state.fetched.length = 0;
      await pullGmailData(testLogger(), extDB, factory, mailbox, '');
      expect(state.fetched).not.toContain('old-1');
    });

    it('give up on a message Gmail no longer has, keeping the cached copy', async () => {
      await staleRow('gone-1');
      const state = {
        historyId: 'h1',
        initial: [] as ReturnType<typeof apiMessage>[],
        added: [] as ReturnType<typeof apiMessage>[],
        gone: ['gone-1'],
        fetched: [] as string[],
      };
      const factory = () => fakeClient(state);

      await pullGmailData(testLogger(), extDB, factory, mailbox, '');
      expect(await getInboxMessageById(extDB, 'gone-1')).toBeDefined();

      // Not asked for again every cycle.
      state.fetched.length = 0;
      await pullGmailData(testLogger(), extDB, factory, mailbox, '');
      expect(state.fetched).not.toContain('gone-1');
    });
  });
});
