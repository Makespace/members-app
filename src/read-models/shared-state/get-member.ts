import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {equipmentTable, membersTable, trainedMemberstable} from './state';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';
import {SharedReadModel} from '.';
import * as RA from 'fp-ts/ReadonlyArray';
import {Member} from './return-types';

export const getMember =
  (db: BetterSQLite3Database): SharedReadModel['members']['get'] =>
  (memberNumber): O.Option<Member> => {
    const getTrainedOn = pipe(
      db
        .select({
          id: trainedMemberstable.equipmentId,
          name: equipmentTable.name,
          trainedAt: trainedMemberstable.trainedAt,
        })
        .from(trainedMemberstable)
        .leftJoin(
          equipmentTable,
          eq(equipmentTable.id, trainedMemberstable.equipmentId)
        )
        .where(eq(trainedMemberstable.memberNumber, memberNumber))
        .all(),
      RA.filter(
        (trainedOnEntry): trainedOnEntry is Member['trainedOn'][number] =>
          trainedOnEntry.name !== undefined
      )
    );

    return pipe(
      db
        .select()
        .from(membersTable)
        .where(eq(membersTable.memberNumber, memberNumber))
        .get(),
      O.fromNullable,
      O.let('trainedOn', () => getTrainedOn)
    );
  };
