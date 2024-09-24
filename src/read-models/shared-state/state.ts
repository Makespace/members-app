import {sql} from 'drizzle-orm';
import {EmailAddress, GravatarHash} from '../../types';
import * as O from 'fp-ts/Option';
import {blob, integer, sqliteTable, text} from 'drizzle-orm/sqlite-core';

type TrainedOn = {
  id: Equipment['id'];
  trainedAt: Date;
};

export const membersTable = sqliteTable('members', {
  memberNumber: integer('memberNumber').notNull().primaryKey(),
  emailAddress: text('emailAddress').notNull().$type<EmailAddress>(),
  gravatarHash: text('gravatarHash').notNull().$type<GravatarHash>(),
  name: blob('name', {mode: 'json'}).notNull().$type<O.Option<string>>(),
  pronouns: blob('pronouns', {mode: 'json'})
    .notNull()
    .$type<O.Option<string>>(),
  prevEmails: blob('prevEmails', {mode: 'json'})
    .notNull()
    .$type<ReadonlyArray<EmailAddress>>(),
  isSuperUser: integer('isSuperUser', {mode: 'boolean'}).notNull(),
  agreementSigned: integer('agreementSigned', {mode: 'timestamp_ms'}),
});

const createMembersTable = sql`
  CREATE TABLE IF NOT EXISTS members (
    memberNumber INTEGER,
    emailAddress TEXT,
    gravatarHash TEXT,
    name BLOB,
    pronouns BLOB,
    prevEmails BLOB,
    isSuperUser INTEGER,
    agreementSigned INTEGER
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
  lastQuizSync INTEGER
  );
`;

export const trainersTable = sqliteTable('trainers', {
  memberNumber: integer('memberNumber')
    .notNull()
    .references(() => membersTable.memberNumber),
  equipmentId: text('equipmentId')
    .notNull()
    .references(() => equipmentTable.id),
});

const createTrainersTable = sql`
  CREATE TABLE IF NOT EXISTS trainers (
    memberNumber INTEGER,
    equipmentID TEXT
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
  trainedBy: integer('trainedBy').references(() => membersTable.memberNumber),
});

const createTrainedMembersTable = sql`
  CREATE TABLE IF NOT EXISTS trainedMembers (
    memberNumber INTEGER,
    equipmentID TEXT,
    trainedAt INTEGER,
    trainedBy INTEGER
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
});

const createOwnersTable = sql`
  CREATE TABLE IF NOT EXISTS owners (
    memberNumber INTEGER,
    areaId TEXT,
    ownershipRecordedAt INTEGER
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
    timestamp INTEGER
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
];

type Member = {
  trainedOn: ReadonlyArray<TrainedOn>;
  memberNumber: number;
  emailAddress: EmailAddress;
  prevEmails: ReadonlyArray<EmailAddress>;
  name: O.Option<string>;
  pronouns: O.Option<string>;
  agreementSigned: O.Option<Date>;
  isSuperUser: boolean;
  gravatarHash: GravatarHash;
};

type Area = {
  id: string;
  owners: Set<number>;
};

type Equipment = {
  id: string;
  name: string;
  areaId: Area['id'];
};

type FailedLinking = {
  memberNumber: number;
  email: string;
};

export type State = {
  members: Map<Member['memberNumber'], Member>;
  areas: Map<Area['id'], Area>;
  equipment: Map<Equipment['id'], Equipment>;
  failedImports: Set<FailedLinking>;
};

export const emptyState = (): State => ({
  members: new Map(),
  areas: new Map(),
  equipment: new Map(),
  failedImports: new Set(),
});
