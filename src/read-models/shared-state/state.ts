import {sql} from 'drizzle-orm';
import {EmailAddress, GravatarHash} from '../../types';
import * as O from 'fp-ts/Option';
import {blob, integer, sqliteTable, text} from 'drizzle-orm/sqlite-core';

export const membersTable = sqliteTable('members', {
  memberNumber: integer('memberNumber').notNull().primaryKey(),
  primaryEmailAddress: text('primaryEmailAddress')
    .notNull()
    .$type<EmailAddress>(),
  gravatarHash: text('gravatarHash').notNull().$type<GravatarHash>(),
  name: blob('name', {mode: 'json'}).notNull().$type<O.Option<string>>(),
  formOfAddress: blob('formOfAddress', {mode: 'json'})
    .notNull()
    .$type<O.Option<string>>(),
  isSuperUser: integer('isSuperUser', {mode: 'boolean'}).notNull(),
  superUserSince: integer('superUserSince', {mode: 'timestamp_ms'}),
  agreementSigned: integer('agreementSigned', {mode: 'timestamp_ms'}),
  status: text('status').notNull(),
  joined: integer('joined', {mode: 'timestamp_ms'}).notNull(),
});

const createMembersTable = sql`
  CREATE TABLE IF NOT EXISTS members (
    memberNumber INTEGER PRIMARY KEY,
    primaryEmailAddress TEXT,
    gravatarHash TEXT,
    name BLOB,
    formOfAddress BLOB,
    isSuperUser INTEGER,
    superUserSince INTEGER,
    agreementSigned INTEGER,
    status TEXT,
    joined INTEGER
  );`;

export const memberEmailsTable = sqliteTable('memberEmails', {
  memberNumber: integer('memberNumber')
    .notNull()
    .references(() => membersTable.memberNumber, { onDelete: 'cascade' }),
  emailAddress: text('emailAddress').notNull().$type<EmailAddress>(),
  addedAt: integer('addedAt', {mode: 'timestamp_ms'}).notNull(),
  verifiedAt: integer('verifiedAt', {mode: 'timestamp_ms'}),
  verificationLastSent: integer('verificationLastSent', {mode: 'timestamp_ms'}),
});

const createMemberEmailsTable = sql`
  CREATE TABLE IF NOT EXISTS memberEmails (
    memberNumber INTEGER,
    emailAddress TEXT,
    addedAt INTEGER,
    verifiedAt INTEGER,
    verificationLastSent INTEGER,
    FOREIGN KEY(memberNumber) REFERENCES members(memberNumber) ON DELETE CASCADE
  );
`;

export const equipmentTable = sqliteTable('equipment', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull(),
  areaId: text('areaId')
    .notNull()
    .references(() => areasTable.id, { onDelete: 'cascade' }),
  trainingSheetId: text('trainingSheetId'),
});

const createEquipmentTable = sql`
  CREATE TABLE IF NOT EXISTS equipment (
    id TEXT PRIMARY KEY,
    name TEXT,
    areaId TEXT,
    trainingSheetId TEXT,
    FOREIGN KEY(areaId) REFERENCES areas(id) ON DELETE CASCADE
  );
`;

export const trainersTable = sqliteTable('trainers', {
  memberNumber: integer('memberNumber')
    .notNull()
    .references(() => membersTable.memberNumber, { onDelete: 'cascade' }),
  equipmentId: text('equipmentId')
    .notNull()
    .references(() => equipmentTable.id, { onDelete: 'cascade' }),
  since: integer('since', {mode: 'timestamp'}).notNull(),
  markedTrainerByActor: text('markedTrainerByActor', {mode: 'json'}).notNull(),
});

const createTrainersTable = sql`
  CREATE TABLE IF NOT EXISTS trainers (
    memberNumber INTEGER,
    equipmentId TEXT,
    since INTEGER,
    markedTrainerByActor TEXT,
    FOREIGN KEY(memberNumber) REFERENCES members(memberNumber) ON DELETE CASCADE,
    FOREIGN KEY(equipmentId) REFERENCES equipment(id) ON DELETE CASCADE
  )
`;

export const trainedMemberstable = sqliteTable('trainedMembers', {
  memberNumber: integer('memberNumber')
    .notNull()
    .references(() => membersTable.memberNumber, { onDelete: 'cascade' }),
  equipmentId: text('equipmentId')
    .notNull()
    .references(() => equipmentTable.id, { onDelete: 'cascade' }),
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
    markTrainedByActor TEXT,
    FOREIGN KEY(memberNumber) REFERENCES members(memberNumber) ON DELETE CASCADE,
    FOREIGN KEY(equipmentId) REFERENCES equipment(id) ON DELETE CASCADE
  )
`;

export const areasTable = sqliteTable('areas', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
});

const createAreasTable = sql`
  CREATE TABLE IF NOT EXISTS areas (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT
  )
`;

export const ownersTable = sqliteTable('owners', {
  memberNumber: integer('memberNumber')
    .notNull()
    .references(() => membersTable.memberNumber, { onDelete: 'cascade' }),
  areaId: text('areaId')
    .notNull()
    .references(() => areasTable.id, { onDelete: 'cascade' }),
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
    markedOwnerByActor TEXT,
    FOREIGN KEY(memberNumber) REFERENCES members(memberNumber) ON DELETE CASCADE,
    FOREIGN KEY(areaId) REFERENCES areas(id) ON DELETE CASCADE
  )
`;

export const trainingStatsNotificationTable = sqliteTable(
  'trainingStatsNotificationTable',
  {
    memberNumber: integer('memberNumber')
      .notNull()
      .references(() => membersTable.memberNumber, { onDelete: 'cascade' }),
    lastEmailSent: integer('lastEmailSent', {mode: 'timestamp'}),
  }
);

const createTrainingStatsNotificationTable = sql`
  CREATE TABLE IF NOT EXISTS trainingStatsNotificationTable (
    memberNumber INTEGER PRIMARY KEY,
    lastEmailSent INTEGER,
    FOREIGN KEY(memberNumber) REFERENCES members(memberNumber) ON DELETE CASCADE
  )
`;

export const eventStateTable = sqliteTable(
  'eventStateTable',
  {
    currentEventIndex: integer('currentEventIndex').notNull()
  }
);

const createEventStateTable = sql`
  CREATE TABLE IF NOT EXISTS eventStateTable (
    currentEventIndex INTEGER NOT NULL
  )
`;

export const createTables = [
  createMembersTable,
  createMemberEmailsTable,
  createAreasTable,
  createEquipmentTable,
  createTrainersTable,
  createTrainedMembersTable,
  createOwnersTable,
  createTrainingStatsNotificationTable,
  createEventStateTable,
];
