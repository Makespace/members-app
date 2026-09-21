import {desc, eq} from 'drizzle-orm';
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
