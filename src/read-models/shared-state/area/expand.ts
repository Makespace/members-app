import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {pipe} from 'fp-ts/lib/function';
import {eq} from 'drizzle-orm';
import {getEquipmentForAreaMinimal} from '../equipment/get';
import {Equipment, MinimalArea, Owner} from '../return-types';
import * as RA from 'fp-ts/ReadonlyArray';
import {ownersTable} from '../state';
import * as O from 'fp-ts/Option';
import {Actor} from '../../../types';
import {expandAll as expandAllEquipment} from '../equipment/expand';
import { getMemberCoreByUserId } from '../member/get';

const expandOwners =
  (db: BetterSQLite3Database) =>
  <T extends MinimalArea>(area: T): T & {owners: ReadonlyArray<Owner>} =>
    pipe(
      db
        .select()
        .from(ownersTable)
        .where(eq(ownersTable.areaId, area.id))
        .all(),
      RA.filterMap(owner =>
        pipe(
          getMemberCoreByUserId(db)(owner.userId),
          O.map(member => ({
            ...member,
            agreementSigned: member.agreementSigned,
            superUserSince: member.superUserSince,
            ownershipRecordedAt: owner.ownershipRecordedAt,
            markedOwnerBy: O.fromEither(Actor.decode(owner.markedOwnerByActor)),
          }))
        )
      ),
      owners => ({
        ...area,
        owners,
      })
    );

const expandEquipment =
  (db: BetterSQLite3Database) =>
  <T extends MinimalArea>(area: T): T & {equipment: ReadonlyArray<Equipment>} =>
    pipe(
      area.id,
      getEquipmentForAreaMinimal(db),
      RA.map(expandAllEquipment(db)),
      equipment => ({
        ...area,
        equipment,
      })
    );

export const expandAll =
  (db: BetterSQLite3Database) =>
  <T extends MinimalArea>(area: T) => {
    return pipe(area, expandEquipment(db), expandOwners(db));
  };
