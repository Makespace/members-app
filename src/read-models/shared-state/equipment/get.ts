import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {equipmentTable} from '../state';
import {EpochTimestampMilliseconds, MinimalEquipment} from '../return-types';
import {UUID} from 'io-ts-types';

const transformRow = <
  R extends {
    id: string;
    areaId: string;
    trainingSheetId: string | undefined | null;
    lastQuizSync: number | undefined | null;
  },
>(
  row: R
) => ({
  ...row,
  id: row.id as UUID,
  areaId: row.areaId as UUID,
  trainingSheetId: O.fromNullable(row.trainingSheetId),
  lastQuizSync: O.fromNullable(
    row.lastQuizSync
  ) as O.Option<EpochTimestampMilliseconds>,
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
