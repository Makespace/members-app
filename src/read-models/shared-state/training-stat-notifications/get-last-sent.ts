import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {MemberLinking} from '../member-linking';
import * as O from 'fp-ts/Option';
import {DateTime} from 'luxon';

export const getLastSent =
  (_db: BetterSQLite3Database, _linking: MemberLinking) =>
  (_memberNumber: number): O.Option<DateTime> =>
    O.none; // TODO. Placeholder.
