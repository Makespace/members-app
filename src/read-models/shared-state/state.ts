import {BuildColumns, SQL, sql} from 'drizzle-orm';
import {EmailAddress, GravatarHash, UserId} from '../../types';
import {UUID} from 'io-ts-types';
import {
  TroubleTicketResponse,
  TroubleTicketStatus,
} from '../../types/trouble-ticket';
import {EquipmentClassification} from '../../types/equipment';
import * as O from 'fp-ts/Option';
import {blob, integer, SQLiteColumnBuilderBase, sqliteTable, SQLiteTableExtraConfig, text, uniqueIndex} from 'drizzle-orm/sqlite-core';

export const createTables: SQL[] = [];
export const truncateTables: SQL[] = [];

const defineTable = <const TTableName extends string, TColumnsMap extends Record<string, SQLiteColumnBuilderBase>>(
  create: SQL,
  tableName: TTableName,
  schema: TColumnsMap,
  extra?: (self: BuildColumns<TTableName, TColumnsMap, 'sqlite'>) => SQLiteTableExtraConfig,
) => {
  createTables.push(create);
  truncateTables.push(sql.raw(`DELETE FROM ${tableName};`));
  return sqliteTable(tableName, schema, extra);
};

export const membersTable = defineTable(
  sql`
  CREATE TABLE IF NOT EXISTS members (
    userId TEXT PRIMARY KEY,
    primaryEmailAddress TEXT,
    gravatarHash TEXT,
    name BLOB,
    formOfAddress BLOB,
    isSuperUser INTEGER,
    superUserSince INTEGER,
    agreementSigned INTEGER,
    joined INTEGER
  );`,
  'members' as const,
  {
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
    joined: integer('joined', {mode: 'timestamp_ms'}).notNull(),
  }
);

export const memberEmailsTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS memberEmails (
      userId TEXT NOT NULL,
      emailAddress TEXT PRIMARY KEY,
      addedAt INTEGER NOT NULL,
      verifiedAt INTEGER,
      verificationLastSent INTEGER,
      FOREIGN KEY (userId) REFERENCES members(userId) ON DELETE CASCADE
    );
  `,
  'memberEmails' as const,
  {
    userId: text('userId')
      .notNull()
      .$type<UserId>()
      .references(() => membersTable.userId, { onDelete: 'cascade' }),
    emailAddress: text('emailAddress').primaryKey().$type<EmailAddress>(),
    addedAt: integer('addedAt', {mode: 'timestamp_ms'}).notNull(),
    verifiedAt: integer('verifiedAt', {mode: 'timestamp_ms'}),
    verificationLastSent: integer('verificationLastSent', {mode: 'timestamp_ms'}),
  }
);

// Individual members may have multiple member numbers so we give each member a unique id
// and then member numbers map to this.
export const memberNumbersTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS memberNumbers (
      memberNumber INTEGER PRIMARY KEY,
      userId TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES members(userId) ON DELETE CASCADE
    );
  `,
  'memberNumbers' as const,
  {
    userId: text('userId')
      .notNull()
      .$type<UserId>()
      .references(() => membersTable.userId, { onDelete: 'cascade' }),
    memberNumber: integer('memberNumber')
      .primaryKey(),
  }
);

export const equipmentTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      name TEXT,
      areaId TEXT,
      trainingSheetId TEXT,
      classification TEXT NOT NULL DEFAULT 'Red',
      FOREIGN KEY(areaId) REFERENCES areas(id) ON DELETE CASCADE
    );
  `,
  'equipment' as const,
  {
    id: text('id').notNull().primaryKey(),
    name: text('name').notNull(),
    areaId: text('areaId')
      .notNull()
      .references(() => areasTable.id, { onDelete: 'cascade' }),
    trainingSheetId: text('trainingSheetId'),
    classification: text('classification')
      .notNull()
      .default('Red')
      .$type<EquipmentClassification>(),
  }
);

export const trainersTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS trainers (
      userId TEXT NOT NULL,
      equipmentId TEXT NOT NULL,
      since INTEGER NOT NULL,
      markedTrainerByActor TEXT NOT NULL,
      UNIQUE(userId, equipmentId),
      FOREIGN KEY (userId) REFERENCES members(userId) ON DELETE CASCADE,
      FOREIGN KEY(equipmentId) REFERENCES equipment(id) ON DELETE CASCADE
    )
  `,
  'trainers' as const,
  {
    userId: text('userId')
      .notNull()
      .$type<UserId>()
      .references(() => membersTable.userId, { onDelete: 'cascade' }),
    equipmentId: text('equipmentId')
      .notNull()
      .references(() => equipmentTable.id, { onDelete: 'cascade' }),
    since: integer('since', {mode: 'timestamp'}).notNull(),
    markedTrainerByActor: text('markedTrainerByActor', {mode: 'json'}).notNull(),
  },
  table => ({
    uniqueTrainer: uniqueIndex('trainers_user_id_equipment_id_unique').on(
      table.userId,
      table.equipmentId
    ),
  })
);

export const trainedMemberstable = defineTable(
  sql`
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
  `,
  'trainedMembers' as const,
  {
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
  }
);

export const areasTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT
    )
  `,
  'areas',
  {
    id: text('id').notNull().primaryKey(),
    name: text('name').notNull(),
    email: text('email'),
  }
);

export const ownersTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS owners (
      userId TEXT NOT NULL,
      areaId TEXT NOT NULL,
      ownershipRecordedAt INTEGER NOT NULL,
      markedOwnerByActor TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES members(userId) ON DELETE CASCADE,
      FOREIGN KEY(areaId) REFERENCES areas(id) ON DELETE CASCADE
    )
  `,
  'owners' as const,
  {
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
  }
);

export const trainingStatsNotificationTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS trainingStatsNotificationTable (
      userId TEXT PRIMARY KEY,
      lastEmailSent INTEGER,
      FOREIGN KEY (userId) REFERENCES members(userId) ON DELETE CASCADE
    )
  `,
  'trainingStatsNotificationTable' as const,
  {
    userId: text('userId')
      .notNull()
      .$type<UserId>()
      .references(() => membersTable.userId, { onDelete: 'cascade' }),
    lastEmailSent: integer('lastEmailSent', {mode: 'timestamp'}),
  }
);

export const troubleTicketsTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS troubleTickets (
      id TEXT PRIMARY KEY,
      rowHash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      submittedAt INTEGER NOT NULL,
      submittedName TEXT,
      submittedMemberNumber INTEGER,
      submittedEmail TEXT,
      submittedEquipment TEXT,
      equipmentId TEXT,
      responseJson TEXT NOT NULL
    )
  `,
  'troubleTickets' as const,
  {
    id: text('id').notNull().primaryKey().$type<UUID>(),
    rowHash: text('rowHash').notNull().unique(),
    status: text('status').notNull().$type<TroubleTicketStatus>(),
    // Editable title; defaults to the form's "issue" text at creation.
    title: text('title').notNull(),
    submittedAt: integer('submittedAt', {mode: 'timestamp_ms'}).notNull(),
    submittedName: text('submittedName'),
    submittedMemberNumber: integer('submittedMemberNumber'),
    submittedEmail: text('submittedEmail'),
    // The raw equipment string from the form; kept so the equipment link can be
    // re-resolved or overridden later.
    submittedEquipment: text('submittedEquipment'),
    // Resolved equipment record; null means the "Unassigned" bucket.
    equipmentId: text('equipmentId').$type<UUID>(),
    responseJson: text('responseJson', {mode: 'json'})
      .notNull()
      .$type<TroubleTicketResponse>(),
  }
);

// Trainers currently assigned to a trouble ticket (many-to-one).
export const troubleTicketAssigneesTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS troubleTicketAssignees (
      ticketId TEXT NOT NULL,
      userId TEXT NOT NULL,
      memberNumber INTEGER NOT NULL,
      assignedAt INTEGER NOT NULL,
      UNIQUE(ticketId, userId),
      FOREIGN KEY (ticketId) REFERENCES troubleTickets(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES members(userId) ON DELETE CASCADE
    )
  `,
  'troubleTicketAssignees' as const,
  {
    ticketId: text('ticketId')
      .notNull()
      .$type<UUID>()
      .references(() => troubleTicketsTable.id, {onDelete: 'cascade'}),
    userId: text('userId')
      .notNull()
      .$type<UserId>()
      .references(() => membersTable.userId, {onDelete: 'cascade'}),
    memberNumber: integer('memberNumber').notNull(),
    assignedAt: integer('assignedAt', {mode: 'timestamp_ms'}).notNull(),
  },
  table => ({
    uniqueAssignee: uniqueIndex('trouble_ticket_assignees_ticket_user_unique').on(
      table.ticketId,
      table.userId
    ),
  })
);

// Status-change event indices we have already sent notification emails for (dedup).
export const troubleTicketNotificationsTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS troubleTicketNotifications (
      notifiedEventIndex INTEGER PRIMARY KEY
    )
  `,
  'troubleTicketNotifications' as const,
  {
    notifiedEventIndex: integer('notifiedEventIndex').notNull().primaryKey(),
  }
);

export const eventStateTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS eventStateTable (
      currentEventIndex INTEGER NOT NULL
    )
  `,
  'eventStateTable' as const,
  {
    currentEventIndex: integer('currentEventIndex').notNull()
  }
);

export const failedEventsTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS failedEventsTable (
      error TEXT NOT NULL,
      eventId TEXT NOT NULL UNIQUE,
      eventIndex INTEGER NOT NULL,
      eventType TEXT NOT NULL,
      payload TEXT NOT NULL
    )
  `,
  'failedEventsTable' as const,
  {
    error: text('error').notNull(),
    eventId: text('eventId').unique().notNull(),
    eventIndex: integer('eventIndex').notNull(),
    eventType: text('eventType').notNull(),
    payload: text('payload', {mode: 'json'}).notNull(),
  }
);
