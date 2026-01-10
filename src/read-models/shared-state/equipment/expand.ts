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
import {getMergedMemberSet} from '../member/get';
import {MemberLinking} from '../member-linking';

const expandTrainers =
  (db: BetterSQLite3Database, linking: MemberLinking) =>
  <T extends MinimalEquipment>(
    equipment: T
  ): T & {trainers: ReadonlyArray<TrainerInfo>} =>
    pipe(
      db
        .select({
          memberNumber: trainersTable.memberNumber,
          trainerSince: trainersTable.since,
          markedTrainerByActor: trainersTable.markedTrainerByActor,
        })
        .from(trainersTable)
        .where(eq(trainersTable.equipmentId, equipment.id))
        .all(),
      RA.filterMap(trainer =>
        pipe(
          linking.map(trainer.memberNumber),
          getMergedMemberSet(db),
          O.map(member => ({
            // Order is important here otherwise the trainedMember memberNumber overwrites the member memberNumber which might not match due to memberNumber linking.
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
  (db: BetterSQLite3Database, linking: MemberLinking) =>
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
          linking.map(trainedMember.memberNumber),
          getMergedMemberSet(db),
          O.map(member => ({
            // Order is important here otherwise the trainedMember memberNumber overwrites the member memberNumber which might not match due to memberNumber linking.
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
                pipe(
                  linking.map(trainedByMemberNumber),
                  getMergedMemberSet(db),
                  O.map(m => m.emailAddress)
                )
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
  (db: BetterSQLite3Database, linking: MemberLinking) =>
  <T extends MinimalEquipment>(equipment: T) => {
    return pipe(
      equipment,
      expandTrainers(db, linking),
      expandTrainedMembers(db, linking),
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
