import {asc, desc, eq, inArray} from 'drizzle-orm';
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

// An email conversation: Gmail already groups replies for us by thread id.
export type InboxThread = {
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

// The most recently active threads. Two queries rather than one grouped
// query: the second fetches every message of the chosen threads, so senders
// and counts come from the same rows the detail page will show.
export const getInboxThreads = async (
  extDB: ExternalStateDB,
  limit: number
): Promise<ReadonlyArray<InboxThread>> => {
  const recent = (
    await extDB
      .select({threadId: gmailMessageTable.gmail_thread_id})
      .from(gmailMessageTable)
      .orderBy(desc(gmailMessageTable.received_at))
      // A thread with many replies would otherwise crowd out older threads,
      // so take a generous slice of messages and group it down.
      .limit(limit * 10)
  ).map(row => row.threadId);
  const threadIds = [...new Set(recent)].slice(0, limit);
  if (threadIds.length === 0) {
    return [];
  }

  const messages = (
    await extDB
      .select()
      .from(gmailMessageTable)
      .where(inArray(gmailMessageTable.gmail_thread_id, threadIds))
      .orderBy(asc(gmailMessageTable.received_at))
  ).map(transformRow);

  const byThread = new Map<string, InboxMessage[]>();
  for (const message of messages) {
    const bucket = byThread.get(message.gmailThreadId) ?? [];
    bucket.push(message);
    byThread.set(message.gmailThreadId, bucket);
  }

  return threadIds.flatMap(threadId => {
    const inThread = byThread.get(threadId);
    if (inThread === undefined || inThread.length === 0) {
      return [];
    }
    return [
      {
        gmailThreadId: threadId,
        latest: inThread[inThread.length - 1],
        messageCount: inThread.length,
        senders: [
          ...new Set(
            inThread
              .map(message => message.fromAddress)
              .filter((from): from is string => from !== null)
          ),
        ],
      },
    ];
  });
};

// Every message in one conversation, oldest first.
export const getInboxThread = async (
  extDB: ExternalStateDB,
  gmailThreadId: string
): Promise<ReadonlyArray<InboxMessage>> =>
  (
    await extDB
      .select()
      .from(gmailMessageTable)
      .where(eq(gmailMessageTable.gmail_thread_id, gmailThreadId))
      .orderBy(asc(gmailMessageTable.received_at))
  ).map(transformRow);

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
