import {sql} from 'drizzle-orm';
import {integer, sqliteTable, text} from 'drizzle-orm/sqlite-core';

// Cached copy of messages from the imported Workspace mailbox. A MUTABLE
// cache in the external-state DB (like the sheet caches) - deliberately not
// the event log: email bodies are PII and retention must stay trivial. Only
// curated facts (e.g. "ticket created from message X") become events.
export const gmailMessageTable = sqliteTable('gmail_message', {
  // Gmail's immutable message id - the dedup key.
  gmail_message_id: text('gmail_message_id').primaryKey(),
  gmail_thread_id: text('gmail_thread_id').notNull(),
  mailbox: text('mailbox').notNull(),
  // The RFC 822 Message-ID header - needed for In-Reply-To when replying.
  rfc822_message_id: text('rfc822_message_id'),
  from_address: text('from_address'),
  to_addresses: text('to_addresses'),
  subject: text('subject'),
  received_at: integer('received_at', {mode: 'timestamp_ms'}).notNull(),
  snippet: text('snippet'),
  body_text: text('body_text'),
  body_html: text('body_html'),
  // Attachment metadata only (filename/mimeType/size/attachmentId) - bodies
  // are fetched on demand in a later PR, if ever.
  attachments_json: text('attachments_json').notNull(),
  label_ids: text('label_ids').notNull(),
  cached_at: integer('cached_at', {mode: 'timestamp_ms'}).notNull(),
});

// Per-mailbox sync state: the Gmail historyId incremental sync cursor.
export const gmailSyncMetadataTable = sqliteTable('gmail_sync_metadata', {
  mailbox: text('mailbox').primaryKey(),
  last_history_id: text('last_history_id'),
  last_sync: integer('last_sync', {mode: 'timestamp_ms'}).notNull(),
});

const createGmailMessageTable = sql`
  CREATE TABLE IF NOT EXISTS gmail_message (
    gmail_message_id TEXT PRIMARY KEY,
    gmail_thread_id TEXT NOT NULL,
    mailbox TEXT NOT NULL,
    rfc822_message_id TEXT,
    from_address TEXT,
    to_addresses TEXT,
    subject TEXT,
    received_at INTEGER NOT NULL,
    snippet TEXT,
    body_text TEXT,
    body_html TEXT,
    attachments_json TEXT NOT NULL,
    label_ids TEXT NOT NULL,
    cached_at INTEGER NOT NULL
  );
`;

const createGmailMessageIndexes = sql`
  CREATE INDEX IF NOT EXISTS gmail_message_received_at_idx ON gmail_message (received_at);
`;

const createGmailSyncMetadataTable = sql`
  CREATE TABLE IF NOT EXISTS gmail_sync_metadata (
    mailbox TEXT PRIMARY KEY,
    last_history_id TEXT,
    last_sync INTEGER NOT NULL
  );
`;

export const createGmailTables = [
  createGmailMessageTable,
  createGmailMessageIndexes,
  createGmailSyncMetadataTable,
];
