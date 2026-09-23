import {asc, desc, eq} from 'drizzle-orm';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {gmailMessageTable} from '../../sync-worker/gmail/gmail-message-table';

export type InboxMessage = {
  gmailMessageId: string;
  gmailThreadId: string;
  fromAddress: string | null;
  toAddresses: string | null;
  subject: string | null;
  receivedAt: Date;
  snippet: string | null;
  bodyText: string | null;
  attachments: ReadonlyArray<{filename: string; size: number}>;
};

type Row = typeof gmailMessageTable.$inferSelect;

const transformRow = (row: Row): InboxMessage => ({
  gmailMessageId: row.gmail_message_id,
  gmailThreadId: row.gmail_thread_id,
  fromAddress: row.from_address,
  toAddresses: row.to_addresses,
  subject: row.subject,
  receivedAt: row.received_at,
  snippet: row.snippet,
  bodyText: row.body_text,
  attachments: JSON.parse(row.attachments_json) as ReadonlyArray<{
    filename: string;
    size: number;
  }>,
});

// Google Groups re-sends each message, so a reply often arrives with a
// different Gmail thread id from the message it answers - the Room Hire
// enquiry and its reply came in as two threads. Conversations are therefore
// grouped by subject, with the list's own tags and reply prefixes stripped.
const normaliseSubject = (subject: string | null): string =>
  (subject ?? '')
    .replace(/^(\s*(re|fwd|fw)\s*:|\s*\[[^\]]*\])+/gi, '')
    .trim()
    .toLowerCase();

// Two unrelated enquiries can share a subject months apart, so a gap this
// long starts a new conversation rather than reviving an old one.
const SAME_CONVERSATION_GAP_MS = 30 * 24 * 60 * 60 * 1000;

// Enough history to group correctly without reading the whole mailbox.
const GROUPING_WINDOW = 500;

// An email conversation.
export type InboxThread = {
  // The earliest message's id: stable, unique, and what the detail page uses.
  conversationId: string;
  gmailThreadId: string;
  // The most recent message, which is what the list shows.
  latest: InboxMessage;
  messageCount: number;
  // Everyone who has written in the thread, oldest first, de-duplicated.
  senders: ReadonlyArray<string>;
};

// Newest first. limit+1 trick left to callers; kept simple for v1.
export const getInboxMessages = async (
  extDB: ExternalStateDB,
  limit: number
): Promise<ReadonlyArray<InboxMessage>> =>
  (
    await extDB
      .select()
      .from(gmailMessageTable)
      .orderBy(desc(gmailMessageTable.received_at))
      .limit(limit)
  ).map(transformRow);

// Groups a run of messages into conversations, oldest first within each.
const toConversations = (
  messages: ReadonlyArray<InboxMessage>
): ReadonlyArray<ReadonlyArray<InboxMessage>> => {
  const open = new Map<string, InboxMessage[]>();
  const closed: InboxMessage[][] = [];
  for (const message of messages) {
    // A message with no usable subject can only be grouped by its thread.
    const key = normaliseSubject(message.subject) || message.gmailThreadId;
    const current = open.get(key);
    const previous = current?.[current.length - 1];
    if (
      current !== undefined &&
      previous !== undefined &&
      message.receivedAt.getTime() - previous.receivedAt.getTime() <
        SAME_CONVERSATION_GAP_MS
    ) {
      current.push(message);
      continue;
    }
    if (current !== undefined) {
      closed.push(current);
    }
    open.set(key, [message]);
  }
  return [...closed, ...open.values()];
};

const summarise = (conversation: ReadonlyArray<InboxMessage>): InboxThread => ({
  conversationId: conversation[0].gmailMessageId,
  gmailThreadId: conversation[0].gmailThreadId,
  latest: conversation[conversation.length - 1],
  messageCount: conversation.length,
  senders: [
    ...new Set(
      conversation
        .map(message => message.fromAddress)
        .filter((from): from is string => from !== null)
    ),
  ],
});

// The most recently active conversations, newest first.
export const getInboxThreads = async (
  extDB: ExternalStateDB,
  limit: number
): Promise<ReadonlyArray<InboxThread>> => {
  const messages = (
    await extDB
      .select()
      .from(gmailMessageTable)
      .orderBy(asc(gmailMessageTable.received_at))
      .limit(GROUPING_WINDOW)
  ).map(transformRow);

  return toConversations(messages)
    .map(summarise)
    .sort(
      (a, b) => b.latest.receivedAt.getTime() - a.latest.receivedAt.getTime()
    )
    .slice(0, limit);
};

// Every message in one conversation, oldest first. Grouping is done here
// rather than in SQL because the key is a normalised subject; the mailbox is
// small enough that reading a window of it costs nothing.
export const getInboxThread = async (
  extDB: ExternalStateDB,
  conversationId: string
): Promise<ReadonlyArray<InboxMessage>> => {
  const messages = (
    await extDB
      .select()
      .from(gmailMessageTable)
      .orderBy(asc(gmailMessageTable.received_at))
      .limit(GROUPING_WINDOW)
  ).map(transformRow);

  return (
    toConversations(messages).find(
      conversation => conversation[0].gmailMessageId === conversationId
    ) ?? []
  );
};

export const getInboxMessageById = async (
  extDB: ExternalStateDB,
  gmailMessageId: string
): Promise<InboxMessage | undefined> =>
  (
    await extDB
      .select()
      .from(gmailMessageTable)
      .where(eq(gmailMessageTable.gmail_message_id, gmailMessageId))
  ).map(transformRow)[0];
