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
import {testLogger} from './util';

const b64 = (value: string) => Buffer.from(value, 'utf8').toString('base64url');

const apiMessage = (id: string, subject: string) => ({
  id,
  threadId: `thread-${id}`,
  snippet: `${subject}…`,
  internalDate: String(1789990000000 + Number(id.replace(/\D/g, '') || 0)),
  labelIds: ['INBOX'],
  payload: {
    mimeType: 'multipart/alternative',
    headers: [
      {name: 'From', value: 'member@example.com'},
      {name: 'Subject', value: subject},
      {name: 'Message-ID', value: `<${id}@example.com>`},
    ],
    parts: [{mimeType: 'text/plain', body: {data: b64(`Body of ${id}`)}}],
  },
});

// A fake Gmail API: bootstrap serves `initial`, incremental serves `added`
// since the cursor; a 404 can be forced to test the expired-cursor fallback.
const fakeClient = (state: {
  historyId: string;
  initial: ReturnType<typeof apiMessage>[];
  added: ReturnType<typeof apiMessage>[];
  expireHistory?: boolean;
}): GmailClient => ({
  getProfile: () => Promise.resolve({historyId: state.historyId}),
  listMessageIds: () =>
    Promise.resolve({
      ids: [...state.initial, ...state.added].map(message => message.id),
    }),
  getMessage: id => {
    const found = [...state.initial, ...state.added].find(
      message => message.id === id
    );
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

    await pullGmailData(testLogger(), extDB, factory, mailbox);
    expect(await getInboxMessages(extDB, 50)).toHaveLength(2);

    state.added = [apiMessage('m3', 'Third')];
    state.historyId = 'h2';
    await pullGmailData(testLogger(), extDB, factory, mailbox);

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
    await pullGmailData(testLogger(), extDB, factory, mailbox);

    state.expireHistory = true;
    state.added = [apiMessage('m2', 'Second')];
    await pullGmailData(testLogger(), extDB, factory, mailbox);

    const messages = await getInboxMessages(extDB, 50);
    expect(messages).toHaveLength(2);
  });
});
