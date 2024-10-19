import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {pipe} from 'fp-ts/lib/function';
import {eq} from 'drizzle-orm';
import {getEquipmentForAreaMinimal} from '../equipment/get';
import {Equipment, MinimalArea, Owner} from '../return-types';
import * as RA from 'fp-ts/ReadonlyArray';
import {membersTable, ownersTable} from '../state';
import * as O from 'fp-ts/Option';
import {Actor} from '../../../types';
import {expandAll as expandAllEquipment} from '../equipment/expand';

const expandOwners =
  (db: BetterSQLite3Database) =>
  <T extends MinimalArea>(area: T): T & {owners: ReadonlyArray<Owner>} =>
    pipe(
      db
        .select()
        .from(membersTable)
        .innerJoin(
          ownersTable,
          eq(membersTable.memberNumber, ownersTable.memberNumber)
        )
        .where(eq(ownersTable.areaId, area.id))
        .all(),
      RA.map(ownerDetails => ({
        ...ownerDetails.members,
        agreementSigned: O.fromNullable(ownerDetails.members.agreementSigned),
        ownershipRecordedAt: ownerDetails.owners.ownershipRecordedAt,
        markedOwnerBy: O.fromEither(
          Actor.decode(ownerDetails.owners.markedOwnerByActor)
        ),
      })),
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
