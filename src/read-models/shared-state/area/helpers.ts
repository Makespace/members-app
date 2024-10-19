import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {getAllAreaMinimal, getAreaMinimal} from './get';
import {expandAll} from './expand';
import {Area} from '../return-types';
import {UUID} from 'io-ts-types';

export const getAllAreaFull =
  (db: BetterSQLite3Database) => (): ReadonlyArray<Area> =>
    pipe(getAllAreaMinimal(db), RA.map(expandAll(db)));

export const getAreaFull =
  (db: BetterSQLite3Database) =>
  (id: UUID): O.Option<Area> =>
    pipe(id, getAreaMinimal(db), O.map(expandAll(db)));
