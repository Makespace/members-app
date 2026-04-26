import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import { pipe } from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {DateTime} from 'luxon';
import { trainingStatsNotificationTable } from '../state';
import { UserId } from '../../../types';
import { eq } from 'drizzle-orm';

export const getLastSent =
  (db: BetterSQLite3Database) =>
  (userId: UserId): O.Option<DateTime> => pipe(
    db
      .select({lastEmailSent: trainingStatsNotificationTable.lastEmailSent})
      .from(trainingStatsNotificationTable)
      .where(eq(trainingStatsNotificationTable.userId, userId))
      .get(),
    O.fromNullable,
    O.map(row => O.fromNullable(row.lastEmailSent)),
    O.flatten,
    O.map(DateTime.fromJSDate),
  );
