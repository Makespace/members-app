import {sql} from 'drizzle-orm';
import {EmailAddress, GravatarHash} from '../../types';
import * as O from 'fp-ts/Option';
import {blob, integer, sqliteTable, text} from 'drizzle-orm/sqlite-core';
export const membersTable = sqliteTable('members', {
  memberNumber: integer('memberNumber').notNull().primaryKey(),
  emailAddress: text('emailAddress').notNull().$type<EmailAddress>(),
  gravatarHash: text('gravatarHash').notNull().$type<GravatarHash>(),
  name: blob('name', {mode: 'json'}).notNull().$type<O.Option<string>>(),
  formOfAddress: blob('formOfAddress', {mode: 'json'})
    .notNull()
    .$type<O.Option<string>>(),
  prevEmails: blob('prevEmails', {mode: 'json'})
    .notNull()
    .$type<ReadonlyArray<EmailAddress>>(),
  isSuperUser: integer('isSuperUser', {mode: 'boolean'}).notNull(),
  superUserSince: integer('superUserSince', {mode: 'timestamp_ms'}),
  agreementSigned: integer('agreementSigned', {mode: 'timestamp_ms'}),
  status: text('status').notNull(),
  joined: integer('joined', {mode: 'timestamp_ms'}).notNull(),
});

const createMembersTable = sql`
  CREATE TABLE IF NOT EXISTS members (
    memberNumber INTEGER,
    emailAddress TEXT,
    gravatarHash TEXT,
    name BLOB,
    formOfAddress BLOB,
    prevEmails BLOB,
    isSuperUser INTEGER,
    superUserSince INTEGER,
    agreementSigned INTEGER,
    status TEXT,
    joined INTEGER
  );`;

export const equipmentTable = sqliteTable('equipment', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull(),
  areaId: text('areaId')
    .notNull()
    .references(() => areasTable.id),
  trainingSheetId: text('trainingSheetId'),
});

const createEquipmentTable = sql`
  CREATE TABLE IF NOT EXISTS equipment (
  id TEXT,
  name TEXT,
  areaId TEXT,
  trainingSheetId TEXT
  );
`;

export const trainersTable = sqliteTable('trainers', {
  memberNumber: integer('memberNumber')
    .notNull()
    .references(() => membersTable.memberNumber),
  equipmentId: text('equipmentId')
    .notNull()
    .references(() => equipmentTable.id),
  since: integer('since', {mode: 'timestamp'}).notNull(),
  markedTrainerByActor: text('markedTrainerByActor', {mode: 'json'}).notNull(),
});

const createTrainersTable = sql`
  CREATE TABLE IF NOT EXISTS trainers (
    memberNumber INTEGER,
    equipmentId TEXT,
    since INTEGER,
    markedTrainerByActor TEXT
  )
`;

export const trainedMemberstable = sqliteTable('trainedMembers', {
  memberNumber: integer('memberNumber')
    .notNull()
    .references(() => membersTable.memberNumber),
  equipmentId: text('equipmentId')
    .notNull()
    .references(() => equipmentTable.id),
  trainedAt: integer('trainedAt', {mode: 'timestamp'}).notNull(),
  trainedByMemberNumber: integer('trainedByMemberNumber'),
  legacyImport: integer('legacyImport', {mode: 'boolean'})
    .notNull()
    .default(false),
  markTrainedByActor: text('markTrainedByActor', {mode: 'json'}).notNull(),
});

const createTrainedMembersTable = sql`
  CREATE TABLE IF NOT EXISTS trainedMembers (
    memberNumber INTEGER,
    equipmentId TEXT,
    trainedAt INTEGER,
    trainedByMemberNumber INTEGER,
    legacyImport INTEGER,
    markTrainedByActor TEXT
  )
`;

export const areasTable = sqliteTable('areas', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull(),
});

const createAreasTable = sql`
  CREATE TABLE IF NOT EXISTS areas (
    id TEXT,
    name TEXT
  )
`;

export const ownersTable = sqliteTable('owners', {
  memberNumber: integer('memberNumber')
    .notNull()
    .references(() => membersTable.memberNumber),
  areaId: text('areaId')
    .notNull()
    .references(() => areasTable.id),
  ownershipRecordedAt: integer('ownershipRecordedAt', {
    mode: 'timestamp',
  }).notNull(),
  markedOwnerByActor: text('markedOwnerByActor', {mode: 'json'}).notNull(),
});

const createOwnersTable = sql`
  CREATE TABLE IF NOT EXISTS owners (
    memberNumber INTEGER,
    areaId TEXT,
    ownershipRecordedAt INTEGER,
    markedOwnerByActor TEXT
  )
`;

export const trainingStatsNotificationTable = sqliteTable(
  'trainingStatsNotificationTable',
  {
    memberNumber: integer('memberNumber')
      .notNull()
      .references(() => membersTable.memberNumber),
    lastEmailSent: integer('lastEmailSent', {mode: 'timestamp'}),
  }
);

const createTrainingStatsNotificationTable = sql`
  CREATE TABLE IF NOT EXISTS trainingStatsNotificationTable (
    memberNumber INTEGER PRIMARY KEY,
    lastEmailSent INTEGER
  )
`;

export const createTables = [
  createMembersTable,
  createEquipmentTable,
  createTrainersTable,
  createTrainedMembersTable,
  createAreasTable,
  createOwnersTable,
  createTrainingStatsNotificationTable,
];
