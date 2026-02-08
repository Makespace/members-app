import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq, isNotNull} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as RR from 'fp-ts/ReadonlyRecord';
import {equipmentTable} from '../state';
import {MinimalEquipment} from '../return-types';
import {UUID} from 'io-ts-types';
import { ReadonlyRecord } from 'fp-ts/lib/ReadonlyRecord';
import { TrainingSheetId } from '../../../types/training-sheet';
import { EquipmentId } from '../../../types/equipment-id';

const transformRow = <
  R extends {
    id: string;
    areaId: string;
    trainingSheetId: string | undefined | null;
  },
>(
  row: R
) => ({
  ...row,
  id: row.id as UUID,
  areaId: row.areaId as UUID,
  trainingSheetId: O.fromNullable(row.trainingSheetId),
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
