import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {and, eq} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {trainingInterestTable} from '../state';

export type TrainingInterest = {
  memberNumber: number;
  firstExpressedAt: Date;
  lastExpressedAt: Date;
};

// Everyone who has told the machine's trainers they would like training,
// whether or not they have been trained since.
export const getTrainingInterestForEquipment =
  (db: BetterSQLite3Database) =>
  (equipmentId: UUID): ReadonlyArray<TrainingInterest> =>
    db
      .select({
        memberNumber: trainingInterestTable.memberNumber,
        firstExpressedAt: trainingInterestTable.firstExpressedAt,
        lastExpressedAt: trainingInterestTable.lastExpressedAt,
      })
      .from(trainingInterestTable)
      .where(eq(trainingInterestTable.equipmentId, equipmentId))
      .all();

export const getTrainingInterestOf =
  (db: BetterSQLite3Database) =>
  (equipmentId: UUID, memberNumber: number): O.Option<TrainingInterest> =>
    O.fromNullable(
      db
        .select({
          memberNumber: trainingInterestTable.memberNumber,
          firstExpressedAt: trainingInterestTable.firstExpressedAt,
          lastExpressedAt: trainingInterestTable.lastExpressedAt,
        })
        .from(trainingInterestTable)
        .where(
          and(
            eq(trainingInterestTable.equipmentId, equipmentId),
            eq(trainingInterestTable.memberNumber, memberNumber)
          )
        )
        .get()
    );
