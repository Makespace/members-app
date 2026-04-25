import {sql} from 'drizzle-orm';
import {
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const recurlySubscriptionTable = sqliteTable(
  'recurly_subscriptions',
  {
    email: text('email').primaryKey(),
    cacheLastUpdated: integer('cacheLastUpdated', {mode: 'timestamp_ms'}).notNull(),
    hasActiveSubscription: integer('hasActiveSubscription', {mode: 'boolean'}).notNull(),
    hasFutureSubscription: integer('hasFutureSubscription', {mode: 'boolean'}).notNull(),
    hasCanceledSubscription: integer('hasCanceledSubscription', {mode: 'boolean'}).notNull(),
    hasPausedSubscription: integer('hasPausedSubscription', {mode: 'boolean'}).notNull(),
    hasPastDueInvoice: integer('hasPastDueInvoice', {mode: 'boolean'}).notNull(),
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

export const createTables = [
  createRecurlySubscriptionTable,
];
