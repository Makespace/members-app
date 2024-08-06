import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';
import {SharedReadModel} from '.';
import * as RA from 'fp-ts/ReadonlyArray';
import {equipmentTable, membersTable, trainersTable} from './state';

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
        RA.map(result => ({
          ...result.members,
          trainedOn: [],
          agreementSigned: O.none,
        }))
      );

    return pipe(
      db.select().from(equipmentTable).where(eq(equipmentTable.id, id)).get(),
      O.fromNullable,
      O.let('trainers', getTrainers)
    );
  };
