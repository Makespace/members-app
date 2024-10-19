import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {areasTable, equipmentTable, membersTable, ownersTable} from './state';
import {UUID} from 'io-ts-types';
import {Area, ExpandedArea, MinimalArea} from './return-types';

export const getMinimalArea =
  (db: BetterSQLite3Database) =>
  (id: UUID): O.Option<MinimalArea> =>
    pipe(
      db.select().from(areasTable).where(eq(areasTable.id, id)).get(),
      O.fromNullable
    );

const getAreaDetails =
  (db: BetterSQLite3Database) =>
  (base: {id: string; name: string}): Area => ({
    id: base.id as UUID,
    name: base.name,
    owners: db
      .select()
      .from(ownersTable)
      .where(eq(ownersTable.areaId, base.id))
      .all(),
    equipment: db
      .select()
      .from(equipmentTable)
      .where(eq(equipmentTable.areaId, base.id))
      .all(),
  });

const getAreaDetailsExpanded =
  (db: BetterSQLite3Database) =>
  (base: {id: string; name: string}): ExpandedArea => ({
    id: base.id as UUID,
    name: base.name,
    owners: pipe(
      db
        .select()
        .from(membersTable)
        .innerJoin(
          ownersTable,
          eq(membersTable.memberNumber, ownersTable.memberNumber)
        )
        .where(eq(ownersTable.areaId, base.id))
        .all(),
      RA.map(ownerDetails => ({
        ...ownerDetails.members,
        agreementSigned: O.fromNullable(ownerDetails.members.agreementSigned),
        
      }))
    ),
    equipment: db
      .select()
      .from(equipmentTable)
      .where(eq(equipmentTable.areaId, base.id))
      .all(),
  });

export const getArea =
  (db: BetterSQLite3Database) =>
  (id: UUID): O.Option<Area> =>
    pipe(id, getMinimalArea(db), O.map(getAreaDetails(db)));

export const getAllArea =
  (db: BetterSQLite3Database) => (): ReadonlyArray<Area> =>
    pipe(db.select().from(areasTable).all(), RA.map(getAreaDetails(db)));

export const getAreaExpanded =
  (db: BetterSQLite3Database) => (): ReadonlyArray<Area> =>
    pipe(
      db.select().from(areasTable).all(),
      RA.map(getAreaDetailsExpanded(db))
    );
