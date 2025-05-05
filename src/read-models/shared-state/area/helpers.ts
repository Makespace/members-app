import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {getAllAreaMinimal, getAreaMinimal} from './get';
import {expandAll} from './expand';
import {Area} from '../return-types';
import {UUID} from 'io-ts-types';
import {equipmentTable, ownersTable} from '../state';
import {and, eq} from 'drizzle-orm';
import {MemberLinking} from '../member-linking';

export const getAllAreaFull =
  (db: BetterSQLite3Database, linking: MemberLinking) =>
  (): ReadonlyArray<Area> =>
    pipe(getAllAreaMinimal(db), RA.map(expandAll(db, linking)));

export const getAreaFull =
  (db: BetterSQLite3Database, linking: MemberLinking) =>
  (id: UUID): O.Option<Area> =>
    pipe(id, getAreaMinimal(db), O.map(expandAll(db, linking)));

export const isOwnerOfAreaContainingEquipment =
  (db: BetterSQLite3Database) => (equipmentId: UUID, memberNumber: number) => {
    const area = db
      .select()
      .from(equipmentTable)
      .where(eq(equipmentTable.id, equipmentId))
      .get();

    if (area) {
      const ownerOf = db
        .select()
        .from(ownersTable)
        .where(
          and(
            eq(ownersTable.memberNumber, memberNumber),
            eq(ownersTable.areaId, area.areaId)
          )
        )
        .get();
      if (ownerOf) {
        return true;
      }
    }
    return false;
  };
