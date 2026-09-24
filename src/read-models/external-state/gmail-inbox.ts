import {desc, eq} from 'drizzle-orm';
import {pipe} from 'fp-ts/lib/function';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {noiseRuleForConversation} from './mailbox-noise';
import {gmailMessageTable} from '../../sync-worker/gmail/gmail-message-table';

export type InboxMessage = {
  gmailMessageId: string;
  gmailThreadId: string;
  // The id the sender's own mail client gave this message. Every group that
  // forwards it keeps this the same, which is how copies are recognised.
  rfc822MessageId: string | null;
  fromAddress: string | null;
  toAddresses: string | null;
  subject: string | null;
  receivedAt: Date;
  snippet: string | null;
  bodyText: string | null;
  // The HTML alternative, when the sender provided one.
  bodyHtml: string | null;
  originalSender: string | null;
  replyTo: string | null;
  listUnsubscribe: string | null;
  autoSubmitted: string | null;
  precedence: string | null;
  attachments: ReadonlyArray<{filename: string; size: number}>;
};

type Row = typeof gmailMessageTable.$inferSelect;

const transformRow = (row: Row): InboxMessage => ({
  gmailMessageId: row.gmail_message_id,
  gmailThreadId: row.gmail_thread_id,
  rfc822MessageId: row.rfc822_message_id,
  fromAddress: row.from_address,
  toAddresses: row.to_addresses,
  subject: row.subject,
  receivedAt: row.received_at,
  snippet: row.snippet,
  bodyText: row.body_text,
  bodyHtml: row.body_html,
  originalSender: row.original_sender,
  replyTo: row.reply_to,
  listUnsubscribe: row.list_unsubscribe,
  autoSubmitted: row.auto_submitted,
  precedence: row.precedence,
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

// The window has to be taken from the NEWEST end: `LIMIT` with an ascending
// sort hands back the oldest messages instead, so once the cache passed 500
// the mailbox froze on its own first 500 messages - new mail never reached
// the list, and a link to a newer conversation was "No such conversation".
// SQL sorts descending to pick the window, and the grouping needs it oldest
// first, so it is turned back round here.
const recentMessages = async (
  extDB: ExternalStateDB
): Promise<ReadonlyArray<InboxMessage>> =>
  (
    await extDB
      .select()
      .from(gmailMessageTable)
      .orderBy(desc(gmailMessageTable.received_at))
      .limit(GROUPING_WINDOW)
  )
    .map(transformRow)
    .reverse();

// An email conversation.
export type InboxThread = {
  // Set when every message in the conversation matched a noise rule; the
  // reason is shown on the row.
  filteredBy: {id: string; reason: string} | undefined;
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

// tickets@ belongs to several groups, so one message sent to more than one
// of them is delivered more than once - same Message-ID, different Gmail
// ids. Keep the first copy of each.
const withoutDuplicates = (
  messages: ReadonlyArray<InboxMessage>
): ReadonlyArray<InboxMessage> => {
  const seen = new Set<string>();
  return messages.filter(message => {
    if (message.rfc822MessageId === null) {
      return true;
    }
    if (seen.has(message.rfc822MessageId)) {
      return false;
    }
    seen.add(message.rfc822MessageId);
    return true;
  });
};

// Groups a run of messages into conversations, oldest first within each.
const toConversations = (
  messages: ReadonlyArray<InboxMessage>
): ReadonlyArray<ReadonlyArray<InboxMessage>> => {
  const open = new Map<string, InboxMessage[]>();
  const closed: InboxMessage[][] = [];
  for (const message of withoutDuplicates(messages)) {
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
  filteredBy: pipe(noiseRuleForConversation(conversation), rule =>
    rule === undefined ? undefined : {id: rule.id, reason: rule.reason}
  ),
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

// The most recently active conversations, newest first. Conversations that
// every rule agrees are noise are left out unless asked for.
export const getInboxThreads = async (
  extDB: ExternalStateDB,
  limit: number,
  options: {includeFiltered: boolean} = {includeFiltered: false}
): Promise<ReadonlyArray<InboxThread>> => {
  const messages = await recentMessages(extDB);

  return toConversations(messages)
    .map(summarise)
    .filter(thread => options.includeFiltered || thread.filteredBy === undefined)
    .sort(
      (a, b) => b.latest.receivedAt.getTime() - a.latest.receivedAt.getTime()
    )
    .slice(0, limit);
};

// How many conversations the rules are currently hiding, so the toggle can
// say what it would reveal.
export const countFilteredConversations = async (
  extDB: ExternalStateDB
): Promise<number> => {
  const messages = await recentMessages(extDB);
  return toConversations(messages)
    .map(summarise)
    .filter(thread => thread.filteredBy !== undefined).length;
};

// Every message in one conversation, oldest first. Grouping is done here
// rather than in SQL because the key is a normalised subject; the mailbox is
// small enough that reading a window of it costs nothing.
export const getInboxThread = async (
  extDB: ExternalStateDB,
  conversationId: string
): Promise<ReadonlyArray<InboxMessage>> => {
  const conversations = toConversations(await recentMessages(extDB));

  // The id names the conversation's earliest message. As the window moves on
  // that message eventually drops out of it, and the conversation is then
  // named by whichever of its messages is still the earliest - so a link
  // someone kept would find nothing. Any message of the conversation
  // identifies it well enough to show.
  return (
    conversations.find(
      conversation => conversation[0].gmailMessageId === conversationId
    ) ??
    conversations.find(conversation =>
      conversation.some(message => message.gmailMessageId === conversationId)
    ) ??
    []
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
