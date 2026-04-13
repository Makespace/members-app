import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';
import * as RA from 'fp-ts/ReadonlyArray';
import {trainedMemberstable, trainersTable} from '../state';
import {
  MinimalArea,
  MinimalEquipment,
  TrainedMember,
  TrainerInfo,
} from '../return-types';
import {Actor} from '../../../types';
import {getAreaMinimal} from '../area/get';
import {getMemberByUserId, getMemberCore} from '../member/get';

const expandTrainers =
  (db: BetterSQLite3Database) =>
  <T extends MinimalEquipment>(
    equipment: T
  ): T & {trainers: ReadonlyArray<TrainerInfo>} =>
    pipe(
      db
        .select({
          userId: trainersTable.userId,
          trainerSince: trainersTable.since,
          markedTrainerByActor: trainersTable.markedTrainerByActor,
        })
        .from(trainersTable)
        .where(eq(trainersTable.equipmentId, equipment.id))
        .all(),
      RA.filterMap(trainer =>
        pipe(
          getMemberByUserId(db)(trainer.userId),
          O.map(member => ({
            ...trainer,
            ...member,
            markedTrainerByActor: O.fromEither(
              Actor.decode(trainer.markedTrainerByActor)
            ),
          }))
        )
      ),
      trainers => ({
        trainers,
        ...equipment,
      })
    );

const expandTrainedMembers =
  (db: BetterSQLite3Database) =>
  <T extends MinimalEquipment>(
    equipment: T
  ): T & {trainedMembers: ReadonlyArray<TrainedMember>} =>
    pipe(
      db
        .select()
        .from(trainedMemberstable)
        .where(eq(trainedMemberstable.equipmentId, equipment.id))
        .orderBy(trainedMemberstable.trainedAt)
        .all(),
      RA.filterMap(trainedMember => {
        const trainedByMemberNumber = O.fromNullable(
          trainedMember.trainedByMemberNumber
        );
        return pipe(
          getMemberByUserId(db)(trainedMember.userId),
          O.map(member => ({
            ...trainedMember,
            ...member,
            trainedSince: trainedMember.trainedAt,
            markedTrainedByActor: O.fromEither(
              Actor.decode(trainedMember.markTrainedByActor)
            ),
            trainedByMemberNumber,
            trainedByEmail: pipe(
              trainedByMemberNumber,
              O.map(trainedByMemberNumber =>
                pipe(trainedByMemberNumber, getMemberCore(db), O.map(m => m.primaryEmailAddress))
              ),
              O.flatten
            ),
            legacyImport: trainedMember.legacyImport,
          }))
        );
      }),
      trainedMembers => ({
        ...equipment,
        trainedMembers,
      })
    );

export const expandAll =
  (db: BetterSQLite3Database) =>
  <T extends MinimalEquipment>(equipment: T) => {
    return pipe(
      equipment,
      expandTrainers(db),
      expandTrainedMembers(db),
      e => ({
        ...e,
        area: O.getOrElse<MinimalArea>(() => ({
          id: e.areaId,
          name: 'unknown',
          email: O.none,
        }))(getAreaMinimal(db)(e.areaId)),
      })
    );
  };
