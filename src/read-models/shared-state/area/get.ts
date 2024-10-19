import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {areasTable} from '../state';
import {UUID} from 'io-ts-types';
import {MinimalArea} from '../return-types';

export const getAreaMinimal =
  (db: BetterSQLite3Database) =>
  (id: UUID): O.Option<MinimalArea> =>
    pipe(
      db.select().from(areasTable).where(eq(areasTable.id, id)).get(),
      O.fromNullable
    );

export const getAllAreaMinimal = (
  db: BetterSQLite3Database
): ReadonlyArray<MinimalArea> => db.select().from(areasTable).all();
