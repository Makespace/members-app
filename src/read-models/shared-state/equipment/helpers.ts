import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {getAllEquipmentMinimal, getEquipmentMinimal} from './get';
import {expandAll} from './expand';
import {Equipment} from '../return-types';
import {UUID} from 'io-ts-types';

export const getAllEquipmentFull =
  (db: BetterSQLite3Database) => (): ReadonlyArray<Equipment> =>
    pipe(getAllEquipmentMinimal(db), RA.map(expandAll(db)));

export const getEquipmentFull =
  (db: BetterSQLite3Database) =>
  (equipmentId: UUID): O.Option<Equipment> =>
    pipe(equipmentId, getEquipmentMinimal(db), O.map(expandAll(db)));
