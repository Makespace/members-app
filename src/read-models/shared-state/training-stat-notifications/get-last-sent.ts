import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import * as O from 'fp-ts/Option';
import {DateTime} from 'luxon';

export const getLastSent =
  (_db: BetterSQLite3Database) =>
  (_memberNumber: number): O.Option<DateTime> =>
    O.none; // TODO. Placeholder.
