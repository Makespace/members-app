import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {
  areasTable,
  equipmentTable,
  membersTable,
  ownersTable,
  trainersTable,
  trainedMemberstable,
} from './state';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';
import {SharedReadModel} from '.';
import * as RA from 'fp-ts/ReadonlyArray';
import {Member} from './return-types';
import {UUID} from 'io-ts-types';

const fieldIsNotNull =
  <K extends string>(key: K) =>
  <T extends Record<K, string | null>>(obj: T): obj is T & {[P in K]: string} =>
    obj[key] !== null;

const fieldIsUUID =
  <K extends string>(key: K) =>
  <T extends Record<K, string | null>>(obj: T): obj is T & {[P in K]: UUID} =>
    E.isRight(UUID.decode(obj[key]));

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
      RA.filter(fieldIsNotNull('name'))
    );

    const getOwnerOf = pipe(
      db
        .select({
          id: ownersTable.areaId,
          name: areasTable.name,
          ownershipRecordedAt: ownersTable.ownershipRecordedAt,
        })
        .from(ownersTable)
        .leftJoin(areasTable, eq(areasTable.id, ownersTable.areaId))
        .where(eq(ownersTable.memberNumber, memberNumber))
        .all(),
      RA.filter(fieldIsNotNull('name'))
    );

    const getTrainerFor = pipe(
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
        .where(eq(trainersTable.memberNumber, memberNumber))
        .all(),
      RA.filter(fieldIsNotNull('equipment_name')),
      RA.filter(fieldIsUUID('equipment_id'))
    );

    return pipe(
      db
        .select()
        .from(membersTable)
        .where(eq(membersTable.memberNumber, memberNumber))
        .get(),
      O.fromNullable,
      O.map(member => ({
        ...member,
        agreementSigned: O.fromNullable(member.agreementSigned),
      })),
      O.let('trainedOn', () => getTrainedOn),
      O.let('ownerOf', () => getOwnerOf),
      O.let('trainerFor', () => getTrainerFor)
    );
  };

export const getAllMember =
  (db: BetterSQLite3Database): SharedReadModel['members']['getAll'] =>
  () =>
    pipe(
      db.select().from(membersTable).all(),
      RA.map(m => {
        const opt = getMember(db)(m.memberNumber);
        if (O.isNone(opt)) {
          throw new Error('');
        }
        return opt.value;
      })
    );
