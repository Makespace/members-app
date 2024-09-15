import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq, isNull} from 'drizzle-orm';
import {SharedReadModel} from '.';
import * as RA from 'fp-ts/ReadonlyArray';
import {
  areasTable,
  equipmentTable,
  membersTable,
  trainedMemberstable,
  trainersTable,
  trainingQuizTable,
} from './state';
import { P } from 'pino';

export const getEquipment =
  (db: BetterSQLite3Database): SharedReadModel['equipment']['get'] =>
  id => {
    const getArea = (areaId: string) =>
      pipe(
        db.select().from(areasTable).where(eq(areasTable.id, areaId)).get(),
        O.fromNullable
      );

    const getTrainers = () =>
      pipe(
        db
          .select()
          .from(membersTable)
          .leftJoin(
            trainersTable,
            eq(membersTable.memberNumber, trainersTable.memberNumber)
          )
          .where(eq(trainersTable.equipmentId, id))
          .all(),
        RA.map(result => result.members),
        RA.map(member => ({
          ...member,
          agreementSigned: O.fromNullable(member.agreementSigned),
        }))
      );

    const getTrainedMembers = () =>
      pipe(
        db
          .select()
          .from(membersTable)
          .leftJoin(
            trainedMemberstable,
            eq(membersTable.memberNumber, trainedMemberstable.memberNumber)
          )
          .where(eq(trainedMemberstable.equipmentId, id))
          .all(),
        RA.map(result => result.members),
        RA.map(member => ({
          ...member,
          agreementSigned: O.fromNullable(member.agreementSigned),
        }))
      );

    const getTrainingQuizResults = () => 
      pipe(
        db
          .select()
          .from(trainingQuizTable)
          .leftJoin( // If member info is null then this is an orphaned result.

          )
          .where(eq(trainingQuizTable.equipmentId, id))
          .all(),
      );

    const getOrphanedTrainingQuizes = () => 
      pipe(
        db
          .select().from(trainingQuizTable)
          .where(isNull(trainingQuizTable.memberNumber))
          .all(),
      );

    return pipe(
      db.select().from(equipmentTable).where(eq(equipmentTable.id, id)).get(),
      O.fromNullable,
      O.let('trainers', getTrainers),
      O.let('trainedMembers', getTrainedMembers),
      O.let('membersAwaitingTraining', getTrainingQuizResults),
      O.let('orphanedPassedQuizes', getOrphanedTrainingQuizes),
      O.bind('area', ({areaId}) => getArea(areaId)),
      foo => foo
    );
  };
