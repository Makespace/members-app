import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq, isNotNull, sql} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as RR from 'fp-ts/ReadonlyRecord';
import {equipmentNameAliasesTable, equipmentTable} from '../state';
import {MinimalEquipment} from '../return-types';
import {EquipmentCategory} from '../../../types/equipment-category';
import {UUID} from 'io-ts-types';
import { ReadonlyRecord } from 'fp-ts/lib/ReadonlyRecord';
import { TrainingSheetId } from '../../../types/training-sheet';
import { EquipmentId } from '../../../types/equipment-id';

const transformRow = <
  R extends {
    id: string;
    areaId: string;
    category: string;
    trainingSheetId: string | undefined | null;
    removedAt: Date | undefined | null;
  },
>(
  row: R
) => ({
  ...row,
  id: row.id as UUID,
  areaId: row.areaId as UUID,
  category: row.category as EquipmentCategory,
  trainingSheetId: O.fromNullable(row.trainingSheetId),
  removedAt: O.fromNullable(row.removedAt),
});

export const getEquipmentForAreaMinimal =
  (db: BetterSQLite3Database) =>
  (areaId: UUID): ReadonlyArray<MinimalEquipment> =>
    pipe(
      db
        .select()
        .from(equipmentTable)
        .where(eq(equipmentTable.areaId, areaId))
        .all(),
      RA.map(transformRow)
    );

export const getEquipmentMinimal =
  (db: BetterSQLite3Database) =>
  (id: UUID): O.Option<MinimalEquipment> =>
    pipe(
      db.select().from(equipmentTable).where(eq(equipmentTable.id, id)).get(),
      O.fromNullable,
      O.map(transformRow)
    );

export const getAllEquipmentMinimal = (
  db: BetterSQLite3Database
): ReadonlyArray<MinimalEquipment> =>
  pipe(db.select().from(equipmentTable).all(), RA.map(transformRow));

// Resolves a freeform equipment name (e.g. from the trouble-ticket form) to a
// known equipment record - by the equipment's own name first, then by its
// registered aliases. Case- and whitespace-insensitive; a miss returns O.none
// and the caller decides what an unresolved name means.
export const resolveEquipmentByName =
  (db: BetterSQLite3Database) =>
  (name: string): O.Option<UUID> => {
    const needle = name.trim().toLowerCase();
    const byName = db
      .select({id: equipmentTable.id})
      .from(equipmentTable)
      .where(sql`lower(trim(${equipmentTable.name})) = ${needle}`)
      .get();
    if (byName !== undefined) {
      return O.some(byName.id as UUID);
    }
    return pipe(
      db
        .select({id: equipmentNameAliasesTable.equipmentId})
        .from(equipmentNameAliasesTable)
        .where(sql`lower(trim(${equipmentNameAliasesTable.alias})) = ${needle}`)
        .get(),
      O.fromNullable,
      O.map(row => row.id)
    );
  };

export const getTrainingSheetIdMapping = (
  db: BetterSQLite3Database
) => (): ReadonlyRecord<TrainingSheetId, EquipmentId> => 
  pipe(
    db.select({
      trainingSheetId: equipmentTable.trainingSheetId,
      id: equipmentTable.id,
    }).from(equipmentTable).where(isNotNull(equipmentTable.trainingSheetId)).all(),
    RA.map(
      row => ([row.trainingSheetId!, row.id as UUID])
    ),
    (x: ReadonlyArray<[string, UUID]>) => x,
    RR.fromEntries
  )
