import {Client} from '@libsql/client';
import {dbExecute} from '../../util';
import {SyncWorkerDependencies} from '../dependencies';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const recurlySubscriptionStatusTable = sqliteTable('recurlySubscriptionStatus', {
  email: text('email').primaryKey(),
});

const ensureRecurlySubStatusTableExists = (recurlyDB: Client) =>
  dbExecute(
    recurlyDB,
    `
    CREATE TABLE IF NOT EXISTS recurlySubscriptionStatus (
        email TEXT PRIMARY KEY,
        hasActiveSubscription BOOLEAN,
        hasFutureSubscription BOOLEAN,
        hasCanceledSubscription BOOLEAN,
        hasPausedSubscription BOOLEAN,
        hasPastDueInvoice BOOLEAN
    );
    `,
    {}
  );

export const ensureRecurlyDBTablesExist =
  (recurlyDB: Client): SyncWorkerDependencies['ensureGoogleDBTablesExist'] =>
  async () => {
    await ensureRecurlySubStatusTableExists(recurlyDB);
  };

