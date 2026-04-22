import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';

import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {SharedReadModel} from '..';
import * as RA from 'fp-ts/ReadonlyArray';
import {Member, MemberCoreInfo} from '../return-types';
import {Actor, EmailAddress, User, UserId} from '../../../types';
import {redactDetailsForActor} from './redact';
import {expandAll} from './expand';
import {findUserIdByEmail, findUserIdByMemberNumber, getAllMemberCore, getMemberCoreByUserId} from './get';
import { liftActorOrUser } from '../../lift-actor-or-user';

export const getMemberAsActorFull =
  (db: BetterSQLite3Database): SharedReadModel['members']['getAsActor'] =>
  (actorOrUser: Actor | User) =>
  (memberNumber: number): O.Option<Member> =>
    pipe(
      memberNumber,
      getMemberFullByMemberNumber(db),
      O.chain(member => {
        const actor = liftActorOrUser(actorOrUser);
        const members = new Map<number, Member>();
        members.set(member.memberNumber, member);
        if (actor.tag === 'user') {
          const actorDetails = getMemberFullByMemberNumber(db)(actor.user.memberNumber);
          if (O.isSome(actorDetails)) {
            members.set(actor.user.memberNumber, actorDetails.value);
          }
        }
        return O.fromNullable(
          redactDetailsForActor(actor)(members).get(member.memberNumber)
        );
      })
    );

export const getAllMemberFull =
  (db: BetterSQLite3Database) =>
  (): ReadonlyArray<Member> =>
    pipe(getAllMemberCore(db), RA.map(expandAll(db)));

export const getMemberFullByUserId =
  (db: BetterSQLite3Database) =>
  (userId: UserId): O.Option<Member> =>
    pipe(userId, getMemberCoreByUserId(db), O.map(expandAll(db)));

export const getMemberCoreByMemberNumber =
  (db: BetterSQLite3Database) =>
  (memberNumber: number): O.Option<MemberCoreInfo> =>
    pipe(memberNumber, findUserIdByMemberNumber(db), O.flatMap(getMemberCoreByUserId(db)));

export const getMemberFullByMemberNumber =
  (db: BetterSQLite3Database) =>
  (memberNumber: number): O.Option<Member> =>
    pipe(memberNumber, findUserIdByMemberNumber(db), O.flatMap(getMemberFullByUserId(db)));

// export const getMemberCoreByEmail =
//   (db: BetterSQLite3Database) =>
//   (email: EmailAddress, mustBeVerified: boolean): O.Option<MemberCoreInfo> =>
//     pipe(findUserIdByEmail(db)(email, mustBeVerified), O.flatMap(getMemberCoreByUserId(db)));

export const getMemberFullByEmail =
  (db: BetterSQLite3Database) =>
  (email: EmailAddress, mustBeVerified: boolean): O.Option<Member> =>
    pipe(findUserIdByEmail(db)(email, mustBeVerified), O.flatMap(getMemberFullByUserId(db)));
