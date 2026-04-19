import {sql} from 'drizzle-orm';
import {EmailAddress, GravatarHash, UserId} from '../../types';
import * as O from 'fp-ts/Option';
import {blob, integer, sqliteTable, text} from 'drizzle-orm/sqlite-core';

export const membersTable = sqliteTable('members', {
  userId: text('userId').primaryKey().$type<UserId>(),
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
    userId TEXT PRIMARY KEY,
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
  userId: text('userId')
    .notNull()
    .$type<UserId>()
    .references(() => membersTable.userId, { onDelete: 'cascade' }),
  emailAddress: text('emailAddress').primaryKey().$type<EmailAddress>(),
  addedAt: integer('addedAt', {mode: 'timestamp_ms'}).notNull(),
  verifiedAt: integer('verifiedAt', {mode: 'timestamp_ms'}),
  verificationLastSent: integer('verificationLastSent', {mode: 'timestamp_ms'}),
});

const createMemberEmailsTable = sql`
  CREATE TABLE IF NOT EXISTS memberEmails (
    userId TEXT NOT NULL,
    emailAddress TEXT PRIMARY KEY,
    addedAt INTEGER NOT NULL,
    verifiedAt INTEGER,
    verificationLastSent INTEGER,
    FOREIGN KEY (userId) REFERENCES members(userId) ON DELETE CASCADE
  );
`;

export const memberNumbersTable = sqliteTable('memberNumbers', {
  userId: text('userId')
    .notNull()
    .$type<UserId>()
    .references(() => membersTable.userId, { onDelete: 'cascade' }),
  memberNumber: integer('memberNumber')
    .primaryKey(),
});

// Individual members may have multiple member numbers so we give each member a unique id
// and then member numbers map to this.
const createMemberNumbersTable = sql`
  CREATE TABLE IF NOT EXISTS memberNumbers (
    memberNumber INTEGER PRIMARY KEY,
    userId TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES members(userId) ON DELETE CASCADE
  );`;

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
  userId: text('userId')
    .notNull()
    .$type<UserId>()
    .references(() => membersTable.userId, { onDelete: 'cascade' }),
  equipmentId: text('equipmentId')
    .notNull()
    .references(() => equipmentTable.id, { onDelete: 'cascade' }),
  since: integer('since', {mode: 'timestamp'}).notNull(),
  markedTrainerByActor: text('markedTrainerByActor', {mode: 'json'}).notNull(),
});

const createTrainersTable = sql`
  CREATE TABLE IF NOT EXISTS trainers (
    userId TEXT NOT NULL,
    equipmentId TEXT NOT NULL,
    since INTEGER NOT NULL,
    markedTrainerByActor TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES members(userId) ON DELETE CASCADE,
    FOREIGN KEY(equipmentId) REFERENCES equipment(id) ON DELETE CASCADE
  )
`;

export const trainedMemberstable = sqliteTable('trainedMembers', {
  userId: text('userId')
    .$type<UserId>()
    .references(() => membersTable.userId, { onDelete: 'cascade' }),
  // Old records may have been brought into the app before the associated member was
  // so we mark them as 'orphaned'.
  memberNumber: integer('memberNumber'),
  equipmentId: text('equipmentId')
    .notNull(),
    // .references(() => equipmentTable.id, { onDelete: 'cascade' }),
  trainedAt: integer('trainedAt', {mode: 'timestamp'}).notNull(),
  trainedByMemberNumber: integer('trainedByMemberNumber'),
  legacyImport: integer('legacyImport', {mode: 'boolean'})
    .notNull()
    .default(false),
  markTrainedByActor: text('markTrainedByActor', {mode: 'json'}).notNull(),
});

const createTrainedMembersTable = sql`
  CREATE TABLE IF NOT EXISTS trainedMembers (
    userId TEXT,
    memberNumber INTEGER,
    equipmentId TEXT NOT NULL,
    trainedAt INTEGER NOT NULL,
    trainedByMemberNumber INTEGER,
    legacyImport INTEGER NOT NULL,
    markTrainedByActor TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES members(userId) ON DELETE CASCADE
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
  userId: text('userId')
    .notNull()
    .$type<UserId>()
    .references(() => membersTable.userId, { onDelete: 'cascade' }),
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
    userId TEXT NOT NULL,
    areaId TEXT NOT NULL,
    ownershipRecordedAt INTEGER NOT NULL,
    markedOwnerByActor TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES members(userId) ON DELETE CASCADE,
    FOREIGN KEY(areaId) REFERENCES areas(id) ON DELETE CASCADE
  )
`;

export const trainingStatsNotificationTable = sqliteTable(
  'trainingStatsNotificationTable',
  {
    userId: text('userId')
      .notNull()
      .$type<UserId>()
      .references(() => membersTable.userId, { onDelete: 'cascade' }),
    lastEmailSent: integer('lastEmailSent', {mode: 'timestamp'}),
  }
);

const createTrainingStatsNotificationTable = sql`
  CREATE TABLE IF NOT EXISTS trainingStatsNotificationTable (
    userId TEXT PRIMARY KEY,
    lastEmailSent INTEGER,
    FOREIGN KEY (userId) REFERENCES members(userId) ON DELETE CASCADE
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

export const failedEventsTable = sqliteTable(
  'failedEventsTable',
  {
    error: text('error').notNull(),
    eventId: text('eventId').unique().notNull(),
    eventIndex: integer('eventIndex').notNull(),
    payload: text('payload', {mode: 'json'}).notNull(),
  }
);

const createFailedEventsTable = sql`
  CREATE TABLE IF NOT EXISTS failedEventsTable (
    error TEXT NOT NULL,
    eventId TEXT NOT NULL UNIQUE,
    eventIndex INTEGER NOT NULL,
    payload TEXT NOT NULL
  )
`;

export const createTables = [
  createMembersTable,
  createMemberEmailsTable,
  createMemberNumbersTable,
  createAreasTable,
  createEquipmentTable,
  createTrainersTable,
  createTrainedMembersTable,
  createOwnersTable,
  createTrainingStatsNotificationTable,
  createEventStateTable,
  createFailedEventsTable,
];
