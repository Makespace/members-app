import {sql} from 'drizzle-orm';
import {
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const recurlySubscriptionTable = sqliteTable(
  'recurly_subscriptions',
  {
    email: text('email').primaryKey(),
    // Recurly's own id for the account. Null for rows cached before it was
    // recorded, and until the next sync refreshes them.
    accountId: text('accountId'),
    cacheLastUpdated: integer('cacheLastUpdated', {mode: 'timestamp_ms'}).notNull(),
    hasActiveSubscription: integer('hasActiveSubscription', {mode: 'boolean'}).notNull(),
    hasFutureSubscription: integer('hasFutureSubscription', {mode: 'boolean'}).notNull(),
    hasCanceledSubscription: integer('hasCanceledSubscription', {mode: 'boolean'}).notNull(),
    hasPausedSubscription: integer('hasPausedSubscription', {mode: 'boolean'}).notNull(),
    hasPastDueInvoice: integer('hasPastDueInvoice', {mode: 'boolean'}).notNull(),
  }
);

// One row per Recurly invoice. `email` is the account's address, lowercased, so
// that it joins to members the same way the subscription cache does.
//
// Money is stored exactly as Recurly reports it - a decimal amount, not minor
// units. This is a mirror of somebody else's record: converting on the way in
// would mean our copy could be wrong in a way theirs isn't.
export const recurlyInvoiceTable = sqliteTable(
  'recurly_invoices',
  {
    id: text('id').primaryKey(),
    // Null when Recurly gave us no address we could use, and none could be
    // recovered from the account. Such a row belongs to no member yet - see
    // reconcileEmails.
    email: text('email'),
    accountId: text('accountId'),
    // The invoice number a member would quote at you.
    number: text('number'),
    // open | pending | processing | past_due | paid | closed | failed | voided
    state: text('state').notNull(),
    // 'automatic' (card on file) or 'manual' (they pay us some other way). An
    // unpaid manual invoice is not a failed payment - nobody has tried yet.
    collectionMethod: text('collectionMethod'),
    currency: text('currency'),
    total: real('total'),
    paid: real('paid'),
    balance: real('balance'),
    createdAt: integer('createdAt', {mode: 'timestamp_ms'}),
    // The clock the follow-up thresholds are measured from.
    dueAt: integer('dueAt', {mode: 'timestamp_ms'}),
    closedAt: integer('closedAt', {mode: 'timestamp_ms'}),
    // How many times Recurly has chased this, and whether it has given up.
    dunningEventsSent: integer('dunningEventsSent'),
    finalDunningEvent: integer('finalDunningEvent', {mode: 'boolean'}),
    // JSON array; an invoice can cover more than one subscription.
    subscriptionIds: text('subscriptionIds'),
    // Recurly's updated_at, which is what the sync cursor advances on.
    updatedAt: integer('updatedAt', {mode: 'timestamp_ms'}),
    cachedAt: integer('cachedAt', {mode: 'timestamp_ms'}).notNull(),
  }
);

// One row per payment attempt. This is where the answer to "why is this
// unpaid?" lives: the gateway's decline message, and the expiry of the card it
// was tried against.
//
// Card details are limited to what a receipt shows - type, last four, expiry.
// Never the number.
export const recurlyTransactionTable = sqliteTable(
  'recurly_transactions',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoiceId'),
    // As on invoices: null until something can be matched to it.
    email: text('email'),
    accountId: text('accountId'),
    // purchase | refund | verify
    type: text('type'),
    // success | declined | error | void
    status: text('status'),
    success: integer('success', {mode: 'boolean'}),
    refunded: integer('refunded', {mode: 'boolean'}),
    amount: real('amount'),
    currency: text('currency'),
    createdAt: integer('createdAt', {mode: 'timestamp_ms'}),
    // When the money actually arrived; null unless it did.
    collectedAt: integer('collectedAt', {mode: 'timestamp_ms'}),
    cardType: text('cardType'),
    lastFour: text('lastFour'),
    expMonth: integer('expMonth'),
    expYear: integer('expYear'),
    // Three renderings of the same refusal, in increasing order of jargon.
    statusMessage: text('statusMessage'),
    customerMessage: text('customerMessage'),
    gatewayMessage: text('gatewayMessage'),
    merchantReasonCode: text('merchantReasonCode'),
    updatedAt: integer('updatedAt', {mode: 'timestamp_ms'}),
    cachedAt: integer('cachedAt', {mode: 'timestamp_ms'}).notNull(),
  }
);

// Where each incremental pull got to, so the next one asks Recurly only for
// what has changed since.
export const recurlySyncMetadataTable = sqliteTable(
  'recurly_sync_metadata',
  {
    // 'invoices' | 'transactions'
    resource: text('resource').primaryKey(),
    cursor: integer('cursor', {mode: 'timestamp_ms'}).notNull(),
  }
);

const createRecurlySubscriptionTable = sql`
  CREATE TABLE IF NOT EXISTS recurly_subscriptions (
    email TEXT PRIMARY KEY,
    cacheLastUpdated INTEGER NOT NULL,
    hasActiveSubscription INTEGER NOT NULL,
    hasFutureSubscription INTEGER NOT NULL,
    hasCanceledSubscription INTEGER NOT NULL,
    hasPausedSubscription INTEGER NOT NULL,
    hasPastDueInvoice INTEGER NOT NULL
  );
`;

const createRecurlyInvoiceTable = sql`
  CREATE TABLE IF NOT EXISTS recurly_invoices (
    id TEXT PRIMARY KEY,
    email TEXT,
    accountId TEXT,
    number TEXT,
    state TEXT NOT NULL,
    collectionMethod TEXT,
    currency TEXT,
    total REAL,
    paid REAL,
    balance REAL,
    createdAt INTEGER,
    dueAt INTEGER,
    closedAt INTEGER,
    dunningEventsSent INTEGER,
    finalDunningEvent INTEGER,
    subscriptionIds TEXT,
    updatedAt INTEGER,
    cachedAt INTEGER NOT NULL
  );
`;

const createRecurlyTransactionTable = sql`
  CREATE TABLE IF NOT EXISTS recurly_transactions (
    id TEXT PRIMARY KEY,
    invoiceId TEXT,
    email TEXT,
    accountId TEXT,
    type TEXT,
    status TEXT,
    success INTEGER,
    refunded INTEGER,
    amount REAL,
    currency TEXT,
    createdAt INTEGER,
    collectedAt INTEGER,
    cardType TEXT,
    lastFour TEXT,
    expMonth INTEGER,
    expYear INTEGER,
    statusMessage TEXT,
    customerMessage TEXT,
    gatewayMessage TEXT,
    merchantReasonCode TEXT,
    updatedAt INTEGER,
    cachedAt INTEGER NOT NULL
  );
`;

const createRecurlySyncMetadataTable = sql`
  CREATE TABLE IF NOT EXISTS recurly_sync_metadata (
    resource TEXT PRIMARY KEY,
    cursor INTEGER NOT NULL
  );
`;

// Both pages look a member up by address, and the member page then wants one
// invoice's attempts.
//
// Kept apart from the table statements and run last: an index over a column
// that arrives by ALTER cannot be built until that ALTER has happened.
export const createRecurlyIndexes = [
  sql`CREATE INDEX IF NOT EXISTS recurly_invoices_email ON recurly_invoices (email);`,
  sql`CREATE INDEX IF NOT EXISTS recurly_transactions_email ON recurly_transactions (email);`,
  sql`CREATE INDEX IF NOT EXISTS recurly_transactions_invoice ON recurly_transactions (invoiceId);`,
  // The reconciliation passes look rows up the other way about.
  sql`CREATE INDEX IF NOT EXISTS recurly_subscriptions_account ON recurly_subscriptions (accountId);`,
  sql`CREATE INDEX IF NOT EXISTS recurly_invoices_account ON recurly_invoices (accountId);`,
  sql`CREATE INDEX IF NOT EXISTS recurly_transactions_account ON recurly_transactions (accountId);`,
];

const createRecurlySchemaVersionTable = sql`
  CREATE TABLE IF NOT EXISTS recurly_schema_version (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL
  );
`;

export const createTables = [
  createRecurlySchemaVersionTable,
  createRecurlySubscriptionTable,
  createRecurlyInvoiceTable,
  createRecurlyTransactionTable,
  createRecurlySyncMetadataTable,
];

// Bumped whenever the invoice or transaction cache changes shape in a way an
// ALTER cannot express - relaxing NOT NULL, for one, which SQLite will not do.
// Both tables are pure copies of what Recurly holds, so the cheapest correct
// migration is to throw them away and fetch them again. The cursor is cleared
// alongside them, so the next pull starts from the beginning rather than from
// today and leaves a hole where the old rows were.
export const RECURLY_CACHE_SCHEMA_VERSION = 2;

export const rebuildBillingCaches = [
  sql`DROP TABLE IF EXISTS recurly_invoices;`,
  sql`DROP TABLE IF EXISTS recurly_transactions;`,
  sql`DELETE FROM recurly_sync_metadata WHERE resource IN ('invoices', 'transactions');`,
  createRecurlyInvoiceTable,
  createRecurlyTransactionTable,
];

// CREATE TABLE IF NOT EXISTS does nothing to a table that already exists, so a
// column added to an existing cache needs an ALTER of its own. These run on
// every boot and are expected to fail once the column is there - see
// ensureRecurlyDBTablesExist, which forgives exactly that error.
export const addRecurlyColumns = [
  sql`ALTER TABLE recurly_subscriptions ADD COLUMN accountId TEXT;`,
];
