import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';
import {SharedReadModel} from '.';
import * as RA from 'fp-ts/ReadonlyArray';
import {
  equipmentTable,
  membersTable,
  trainedMemberstable,
  trainersTable,
} from './state';

export const getEquipment =
  (db: BetterSQLite3Database): SharedReadModel['equipment']['get'] =>
  id => {
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

    return pipe(
      db.select().from(equipmentTable).where(eq(equipmentTable.id, id)).get(),
      O.fromNullable,
      O.let('trainers', getTrainers),
      O.let('trainedMembers', getTrainedMembers)
    );
  };
