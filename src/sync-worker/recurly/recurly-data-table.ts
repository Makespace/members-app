import {sql} from 'drizzle-orm';
import {
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const recurlySubscriptionTable = sqliteTable(
  'recurly_subscriptions',
  {
    email: text('email').primaryKey(),
  }
);

const createRecurlySubscriptionTable = sql`
  CREATE TABLE IF NOT EXISTS recurly_subscriptions (
    email TEXT PRIMARY KEY
  );
`;

export const createTables = [
  createRecurlySubscriptionTable,
];
