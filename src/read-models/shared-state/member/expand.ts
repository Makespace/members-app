import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {
  areasTable,
  equipmentTable,
  ownersTable,
  trainersTable,
  trainedMemberstable,
} from '../state';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq, inArray} from 'drizzle-orm';
import * as RA from 'fp-ts/ReadonlyArray';
import {
  allMemberNumbers,
  MemberCoreInfo,
  OwnerOf,
  TrainedOn,
  TrainerFor,
} from '../return-types';
import {Actor} from '../../../types';
import {fieldIsNotNull, fieldIsUUID} from '../../../util';

const expandTrainedOn =
  (db: BetterSQLite3Database) =>
  <T extends MemberCoreInfo>(
    member: T
  ): T & {trainedOn: ReadonlyArray<TrainedOn>} =>
    pipe(
      db
        .select({
          id: trainedMemberstable.equipmentId,
          name: equipmentTable.name,
          trainedAt: trainedMemberstable.trainedAt,
          trainedByActor: trainedMemberstable.markTrainedByActor,
        })
        .from(trainedMemberstable)
        .innerJoin(
          equipmentTable,
          eq(equipmentTable.id, trainedMemberstable.equipmentId)
        )
        .where(
          inArray(
            trainedMemberstable.memberNumber,
            allMemberNumbers(member) as number[]
          )
        )
        .all(),
      RA.map(row => ({
        ...row,
        markedTrainedByActor: O.fromEither(Actor.decode(row.trainedByActor)),
      })),
      trainedOn => ({
        ...member,
        trainedOn,
      })
    );

const expandOwnerOf =
  (db: BetterSQLite3Database) =>
  <T extends MemberCoreInfo>(
    member: T
  ): T & {ownerOf: ReadonlyArray<OwnerOf>} =>
    pipe(
      db
        .select({
          id: ownersTable.areaId,
          name: areasTable.name,
          ownershipRecordedAt: ownersTable.ownershipRecordedAt,
        })
        .from(ownersTable)
        .leftJoin(areasTable, eq(areasTable.id, ownersTable.areaId))
        .where(
          inArray(
            ownersTable.memberNumber,
            allMemberNumbers(member) as number[]
          )
        )
        .all(),
      RA.filter(fieldIsNotNull('name')),
      ownerOf => ({
        ...member,
        ownerOf,
      })
    );

const expandTrainerFor =
  (db: BetterSQLite3Database) =>
  <T extends MemberCoreInfo>(
    member: T
  ): T & {trainerFor: ReadonlyArray<TrainerFor>} =>
    pipe(
      db
        .select({
          equipment_id: trainersTable.equipmentId,
          equipment_name: equipmentTable.name,
          since: trainersTable.since,
        })
        .from(trainersTable)
        .leftJoin(
          equipmentTable,
          eq(trainersTable.equipmentId, equipmentTable.id)
        )
        .where(
          inArray(
            trainersTable.memberNumber,
            allMemberNumbers(member) as number[]
          )
        )
        .all(),
      RA.filter(fieldIsNotNull('equipment_name')),
      RA.filter(fieldIsUUID('equipment_id')),
      trainerFor => ({
        ...member,
        trainerFor,
      })
    );

export const expandAll =
  (db: BetterSQLite3Database) =>
  <T extends MemberCoreInfo>(member: T) => {
    return pipe(
      member,
      expandTrainedOn(db),
      expandOwnerOf(db),
      expandTrainerFor(db)
    );
  };
