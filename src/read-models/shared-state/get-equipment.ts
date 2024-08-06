import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';
import {SharedReadModel} from '.';
import {equipmentTable} from './state';

export const getEquipment =
  (db: BetterSQLite3Database): SharedReadModel['equipment']['get'] =>
  id =>
    pipe(
      db.select().from(equipmentTable).where(eq(equipmentTable.id, id)).get(),
      O.fromNullable
    );
