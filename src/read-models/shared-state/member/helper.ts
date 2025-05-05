import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';

import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {SharedReadModel} from '..';
import * as RA from 'fp-ts/ReadonlyArray';
import {Member} from '../return-types';
import {Actor, User} from '../../../types';
import {redactDetailsForActor} from './redact';
import {liftActorOrUser} from '../../members/get-all';
import {expandAll} from './expand';
import {getAllMemberCore, getMemberCore} from './get';
import {MemberLinking} from '../member-linking';

export const getMemberAsActorFull =
  (
    db: BetterSQLite3Database,
    linking: MemberLinking
  ): SharedReadModel['members']['getAsActor'] =>
  (actorOrUser: Actor | User) =>
  (memberNumber: number): O.Option<Member> =>
    pipe(
      memberNumber,
      getMemberFull(db, linking),
      O.chain(member => {
        const actor = liftActorOrUser(actorOrUser);
        const members = new Map<number, Member>();
        members.set(member.memberNumber, member);
        if (actor.tag === 'user') {
          const actorDetails = getMemberFull(
            db,
            linking
          )(actor.user.memberNumber);
          if (O.isSome(actorDetails)) {
            members.set(actor.user.memberNumber, actorDetails.value);
          }
        }
        return O.fromNullable(
          redactDetailsForActor(actor)(members).get(memberNumber)
        );
      })
    );

export const getAllMemberFull =
  (db: BetterSQLite3Database, linking: MemberLinking) =>
  (): ReadonlyArray<Member> =>
    pipe(getAllMemberCore(db, linking), RA.map(expandAll(db)));

export const getMemberFull =
  (db: BetterSQLite3Database, linking: MemberLinking) =>
  (memberNumber: number): O.Option<Member> =>
    pipe(memberNumber, getMemberCore(db, linking), O.map(expandAll(db)));
