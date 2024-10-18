import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {
  areasTable,
  equipmentTable,
  membersTable,
  ownersTable,
  trainedMemberstable,
} from './state';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';
import {SharedReadModel} from '.';
import * as RA from 'fp-ts/ReadonlyArray';
import {Member} from './return-types';
import {Actor, User} from '../../types';
import {redactDetailsForActor} from '../members/redact';
import {liftActorOrUser} from '../members/get-all';

const fieldIsNotNull =
  <K extends string>(key: K) =>
  <T extends Record<K, string | null>>(obj: T): obj is T & {[P in K]: string} =>
    obj[key] !== null;

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
      O.let('ownerOf', () => getOwnerOf)
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

export const getMemberAsActor =
  (db: BetterSQLite3Database): SharedReadModel['members']['getAsActor'] =>
  (actorOrUser: Actor | User) =>
  (memberNumber: number): O.Option<Member> =>
    pipe(
      memberNumber,
      getMember(db),
      O.chain(member => {
        const actor = liftActorOrUser(actorOrUser);
        const members = new Map<number, Member>();
        members.set(member.memberNumber, member);
        if (actor.tag === 'user') {
          const actorDetails = getMember(db)(actor.user.memberNumber);
          if (O.isSome(actorDetails)) {
            members.set(actor.user.memberNumber, actorDetails.value);
          }
        }
        return O.fromNullable(
          redactDetailsForActor(actor)(members).get(memberNumber)
        );
      })
    );
