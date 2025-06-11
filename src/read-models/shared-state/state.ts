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
    status TEXT
  );`;

export const equipmentTable = sqliteTable('equipment', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull(),
  areaId: text('areaId')
    .notNull()
    .references(() => areasTable.id),
  trainingSheetId: text('trainingSheetId'),
  lastQuizSync: integer('lastQuizSync'),
});

const createEquipmentTable = sql`
  CREATE TABLE IF NOT EXISTS equipment (
  id TEXT,
  name TEXT,
  areaId TEXT,
  trainingSheetId TEXT,
  lastQuizSync INTEGER,
  lastRowRead
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

export const trainingQuizTable = sqliteTable('trainingQuizResults', {
  quizId: text('quizId').notNull().primaryKey(),
  equipmentId: text('equipmentId')
    .notNull()
    .references(() => equipmentTable.id),
  sheetId: text('sheetId').notNull(),
  // Member number might not be linked to a member if it is entered incorrectly.
  memberNumberProvided: integer('memberNumberProvided'),
  emailProvided: text('emailProvided'),
  score: integer('score').notNull(),
  maxScore: integer('maxScore').notNull(),
  timestamp: integer('timestamp', {mode: 'timestamp'}).notNull(),
});

const createTrainingQuizTable = sql`
  CREATE TABLE IF NOT EXISTS trainingQuizResults (
    quizId TEXT,
    equipmentId TEXT,
    sheetId TEXT,
    memberNumberProvided INTEGER,
    emailProvided TEXT,
    score INTEGER,
    maxScore INTEGER,
    timestamp INTEGER,
    UNIQUE(equipmentId, sheetId, memberNumberProvided, emailProvided, timestamp)
  )
`;

export const troubleTicketResponsesTable = sqliteTable(
  'troubleTicketResponses',
  {
    responseSubmitted: integer('responseSubmitted', {
      mode: 'timestamp',
    }).notNull(),
    emailAddress: text('emailAddress'),
    whichEquipment: text('whichEquipment'), // FIXME - This should be the equipment_id if found
    submitterName: text('submitterName'),
    submitterMembershipNumber: integer('submitterMembershipNumber'),
    submittedResponse: text('submittedResponse', {mode: 'json'}),
  }
);

// Using response_submitted, email_address, which_equipment as the unique key is temporary
// for POC. In future we should probably use the row index or something from the trouble tickets sheet.
const createTroubleTicketResponsesTable = sql`
  CREATE TABLE IF NOT EXISTS troubleTicketResponses (
    responseSubmitted INTEGER,
    emailAddress TEXT,
    whichEquipment TEXT,
    submitterName TEXT,
    submitterMembershipNumber INTEGER,
    submittedResponse TEXT,
    UNIQUE(responseSubmitted, emailAddress, whichEquipment)
  )
`;

export const createTables = [
  createMembersTable,
  createEquipmentTable,
  createTrainersTable,
  createTrainedMembersTable,
  createAreasTable,
  createOwnersTable,
  createTrainingQuizTable,
  createTroubleTicketResponsesTable,
];
