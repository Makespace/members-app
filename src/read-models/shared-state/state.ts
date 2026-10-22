import {BuildColumns, SQL, sql} from 'drizzle-orm';
import {UUID} from 'io-ts-types';
import {EmailAddress, GravatarHash, UserId} from '../../types';
import {
  TroubleTicketResponse,
  TroubleTicketStatus,
} from '../../types/trouble-ticket';
import {MailboxArchiveReason} from '../../types/mailbox-archive-reason';
import {
  PurchaseApproval,
  PurchaseRequestOutcome,
} from '../../types/purchase-request-outcome';
import {ReminderStage} from '../../owner-agreement/reminder-stage';
import {InterestedIn} from '../../owner-agreement/agreement';
import * as O from 'fp-ts/Option';
import {blob, integer, SQLiteColumnBuilderBase, sqliteTable, SQLiteTableExtraConfig, text, uniqueIndex} from 'drizzle-orm/sqlite-core';
import {RecordedSpendKind} from '../../types/recorded-spend-kind';
import {PurchaseRequestStatus} from '../../types/purchase-request-status';

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
    agreementVersion TEXT,
    agreementTermEnds INTEGER,
    agreementInterestedIn BLOB,
    agreementReminderSent TEXT,
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
    // The latest owner agreement signed: when, which version, the end of its
    // term (if that version has one), the responsibilities picked, and the
    // most urgent renewal reminder sent for that term.
    agreementSigned: integer('agreementSigned', {mode: 'timestamp_ms'}),
    agreementVersion: text('agreementVersion'),
    agreementTermEnds: integer('agreementTermEnds', {mode: 'timestamp_ms'}),
    agreementInterestedIn: blob('agreementInterestedIn', {
      mode: 'json',
    }).$type<InterestedIn>(),
    agreementReminderSent: text('agreementReminderSent').$type<ReminderStage>(),
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
      linkedByAdmin INTEGER NOT NULL DEFAULT 0,
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
    // Verified on an admin's say-so from the Recurly billing record rather
    // than by the member; shown as such.
    linkedByAdmin: integer('linkedByAdmin', {mode: 'boolean'}).notNull().default(false),
  }
);

// Paxton fobs, keyed by Paxton's fob id so a fob reassigned to another
// member moves rather than duplicates. A member may hold several.
export const memberFobsTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS memberFobs (
      fobId INTEGER PRIMARY KEY,
      userId TEXT NOT NULL,
      accessLevel TEXT NOT NULL,
      paxtonName TEXT NOT NULL,
      recordedAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES members(userId) ON DELETE CASCADE
    );
  `,
  'memberFobs' as const,
  {
    fobId: integer('fobId').primaryKey(),
    userId: text('userId')
      .notNull()
      .$type<UserId>()
      .references(() => membersTable.userId, {onDelete: 'cascade'}),
    accessLevel: text('accessLevel').notNull(),
    paxtonName: text('paxtonName').notNull(),
    recordedAt: integer('recordedAt', {mode: 'timestamp_ms'}).notNull(),
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
      category TEXT NOT NULL DEFAULT 'red',
      machineNamesJson TEXT,
      trainingSheetId TEXT,
      guideUrl TEXT,
      riskAssessmentUrl TEXT,
      learnPoints TEXT,
      removedAt INTEGER,
      areaCategoryId TEXT,
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
    // red / orange / green sticker category; only red has training machinery.
    category: text('category').notNull().default('red'),
    // JSON array of unit names when this record stands for several identical
    // machines (e.g. Printer 1, Printer 2); null/absent means a single one.
    machineNamesJson: text('machineNamesJson'),
    trainingSheetId: text('trainingSheetId'),
    // The machine's page on equipment.makespace.org, as recorded by an owner.
    guideUrl: text('guideUrl'),
    riskAssessmentUrl: text('riskAssessmentUrl'),
    // What to learn before using it, one point per line, for its sign.
    learnPoints: text('learnPoints'),
    // When set, the equipment is obsolete: hidden from members browsing for
    // training, but kept (with its history) for owners/admins.
    removedAt: integer('removedAt', {mode: 'timestamp_ms'}),
    // The area's own grouping for it (areaEquipmentCategories), if any.
    areaCategoryId: text('areaCategoryId').$type<UUID>(),
  }
);

// Alternative names that resolve to equipment (e.g. the trouble-ticket form's
// labels). One alias maps to exactly one equipment; matching is case- and
// whitespace-insensitive via the NOCASE collation plus trimming at write time.
// What each member has said they want to hear about, one row per scope they
// have an opinion on. Saying "follow whatever is above me" removes the row:
// the absence of a row is what following means, so there is one way to say it
// rather than two.
export const memberNotificationPreferencesTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS memberNotificationPreferences (
      memberNumber INTEGER NOT NULL,
      scope TEXT NOT NULL,
      preference TEXT NOT NULL,
      PRIMARY KEY (memberNumber, scope)
    )
  `,
  'memberNotificationPreferences' as const,
  {
    memberNumber: integer('memberNumber').notNull(),
    scope: text('scope').notNull(),
    preference: text('preference').notNull(),
  }
);

// When each member was last sent a summary, and how far through the log it
// reached. One row per member and cadence; absent until the first one is sent.
// How many trouble ticket notifications somebody has been sent. Only used to
// stop explaining the system to people who have clearly met it already.
export const memberNotificationEmailsTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS memberNotificationEmails (
      memberNumber INTEGER PRIMARY KEY,
      sent INTEGER NOT NULL
    )
  `,
  'memberNotificationEmails' as const,
  {
    memberNumber: integer('memberNumber').notNull().primaryKey(),
    sent: integer('sent').notNull(),
  }
);

export const memberDigestsTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS memberDigests (
      memberNumber INTEGER NOT NULL,
      cadence TEXT NOT NULL,
      sentAt INTEGER NOT NULL,
      upToEventIndex INTEGER NOT NULL,
      PRIMARY KEY (memberNumber, cadence)
    )
  `,
  'memberDigests' as const,
  {
    memberNumber: integer('memberNumber').notNull(),
    cadence: text('cadence').notNull(),
    sentAt: integer('sentAt', {mode: 'timestamp_ms'}).notNull(),
    upToEventIndex: integer('upToEventIndex').notNull(),
  }
);

export const equipmentNameAliasesTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS equipmentNameAliases (
      alias TEXT PRIMARY KEY COLLATE NOCASE,
      equipmentId TEXT NOT NULL
    )
  `,
  'equipmentNameAliases' as const,
  {
    alias: text('alias').primaryKey(),
    equipmentId: text('equipmentId').notNull().$type<UUID>(),
  }
);

// Freeform labels that resolve to a whole area (see equipmentNameAliases).
export const areaNameAliasesTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS areaNameAliases (
      alias TEXT PRIMARY KEY COLLATE NOCASE,
      areaId TEXT NOT NULL
    )
  `,
  'areaNameAliases' as const,
  {
    alias: text('alias').primaryKey(),
    areaId: text('areaId').notNull().$type<UUID>(),
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

// Groupings an area defines for its own equipment; see
// AreaEquipmentCategoryAdded. Listed in the order they were added.
export const areaEquipmentCategoriesTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS areaEquipmentCategories (
      id TEXT PRIMARY KEY,
      areaId TEXT NOT NULL,
      name TEXT NOT NULL,
      addedAt INTEGER NOT NULL,
      FOREIGN KEY(areaId) REFERENCES areas(id) ON DELETE CASCADE
    )
  `,
  'areaEquipmentCategories' as const,
  {
    id: text('id').notNull().primaryKey().$type<UUID>(),
    areaId: text('areaId')
      .notNull()
      .$type<UUID>()
      .references(() => areasTable.id, {onDelete: 'cascade'}),
    name: text('name').notNull(),
    addedAt: integer('addedAt', {mode: 'timestamp_ms'}).notNull(),
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

// Budget-holding groups of areas; see PurchasingAreaCreated. Money in pence.
export const purchasingAreasTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS purchasingAreas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      yearlyBudgetPence INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    )
  `,
  'purchasingAreas' as const,
  {
    id: text('id').notNull().primaryKey().$type<UUID>(),
    name: text('name').notNull(),
    yearlyBudgetPence: integer('yearlyBudgetPence').notNull(),
    createdAt: integer('createdAt', {mode: 'timestamp_ms'}).notNull(),
  }
);

// A purchasing area's budget for one calendar year, where it differs from
// the usual one; see PurchasingAreaYearBudgetSet.
export const purchasingAreaYearBudgetsTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS purchasingAreaYearBudgets (
      purchasingAreaId TEXT NOT NULL,
      budgetYear INTEGER NOT NULL,
      yearlyBudgetPence INTEGER NOT NULL,
      PRIMARY KEY (purchasingAreaId, budgetYear)
    )
  `,
  'purchasingAreaYearBudgets' as const,
  {
    purchasingAreaId: text('purchasingAreaId').notNull().$type<UUID>(),
    budgetYear: integer('budgetYear').notNull(),
    yearlyBudgetPence: integer('yearlyBudgetPence').notNull(),
  }
);

// Spending recorded directly against a purchasing area for a year; see
// PurchasingAreaSpendRecorded. Removed rows are deleted.
export const purchasingAreaSpendTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS purchasingAreaSpend (
      id TEXT PRIMARY KEY,
      purchasingAreaId TEXT NOT NULL,
      budgetYear INTEGER NOT NULL,
      amountPence INTEGER NOT NULL,
      description TEXT NOT NULL,
      kind TEXT NOT NULL,
      recordedAt INTEGER NOT NULL
    )
  `,
  'purchasingAreaSpend' as const,
  {
    id: text('id').notNull().primaryKey().$type<UUID>(),
    purchasingAreaId: text('purchasingAreaId').notNull().$type<UUID>(),
    budgetYear: integer('budgetYear').notNull(),
    amountPence: integer('amountPence').notNull(),
    description: text('description').notNull(),
    kind: text('kind').notNull().$type<RecordedSpendKind>(),
    recordedAt: integer('recordedAt', {mode: 'timestamp_ms'}).notNull(),
  }
);

// Which purchasing area each area belongs to. Keyed on the area, as an area
// belongs to at most one.
export const purchasingAreaAreasTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS purchasingAreaAreas (
      areaId TEXT PRIMARY KEY,
      purchasingAreaId TEXT NOT NULL,
      FOREIGN KEY(areaId) REFERENCES areas(id) ON DELETE CASCADE,
      FOREIGN KEY(purchasingAreaId) REFERENCES purchasingAreas(id) ON DELETE CASCADE
    )
  `,
  'purchasingAreaAreas' as const,
  {
    areaId: text('areaId')
      .notNull()
      .primaryKey()
      .$type<UUID>()
      .references(() => areasTable.id, {onDelete: 'cascade'}),
    purchasingAreaId: text('purchasingAreaId')
      .notNull()
      .$type<UUID>()
      .references(() => purchasingAreasTable.id, {onDelete: 'cascade'}),
  }
);

// Members who may submit purchase requests for a purchasing area. By user id
// rather than member number, like owners, so a rejoined member keeps it.
export const purchasersTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS purchasers (
      purchasingAreaId TEXT NOT NULL,
      userId TEXT NOT NULL,
      addedAt INTEGER NOT NULL,
      PRIMARY KEY (purchasingAreaId, userId),
      FOREIGN KEY (userId) REFERENCES members(userId) ON DELETE CASCADE,
      FOREIGN KEY(purchasingAreaId) REFERENCES purchasingAreas(id) ON DELETE CASCADE
    )
  `,
  'purchasers' as const,
  {
    purchasingAreaId: text('purchasingAreaId')
      .notNull()
      .$type<UUID>()
      .references(() => purchasingAreasTable.id, {onDelete: 'cascade'}),
    userId: text('userId')
      .notNull()
      .$type<UserId>()
      .references(() => membersTable.userId, {onDelete: 'cascade'}),
    addedAt: integer('addedAt', {mode: 'timestamp_ms'}).notNull(),
  }
);

// Every purchase request as submitted, with the outcome the server computed.
// budgetYear is the calendar year (Europe/London) it was submitted in.
export const purchaseRequestsTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS purchaseRequests (
      id TEXT PRIMARY KEY,
      purchasingAreaId TEXT NOT NULL,
      submittedByMemberNumber INTEGER NOT NULL,
      submittedAt INTEGER NOT NULL,
      budgetYear INTEGER NOT NULL,
      summary TEXT NOT NULL,
      totalPence INTEGER NOT NULL,
      purchasesJson TEXT NOT NULL,
      justification TEXT NOT NULL,
      isMemberPaidConsumable INTEGER NOT NULL,
      affectedAreaIdsJson TEXT NOT NULL,
      healthAndSafetyRisk INTEGER NOT NULL,
      proposalJson TEXT,
      status TEXT NOT NULL,
      decidedAt INTEGER,
      decidedByMemberNumber INTEGER,
      declineReason TEXT,
      outcome TEXT NOT NULL,
      approval TEXT NOT NULL,
      outcomeReason TEXT NOT NULL,
      yearlyBudgetPence INTEGER NOT NULL,
      spentThisYearPence INTEGER NOT NULL
    )
  `,
  'purchaseRequests' as const,
  {
    id: text('id').notNull().primaryKey().$type<UUID>(),
    purchasingAreaId: text('purchasingAreaId').notNull().$type<UUID>(),
    submittedByMemberNumber: integer('submittedByMemberNumber').notNull(),
    submittedAt: integer('submittedAt', {mode: 'timestamp_ms'}).notNull(),
    budgetYear: integer('budgetYear').notNull(),
    summary: text('summary').notNull(),
    totalPence: integer('totalPence').notNull(),
    // The shops/websites and what is bought from each, as JSON.
    purchasesJson: text('purchasesJson').notNull(),
    justification: text('justification').notNull(),
    isMemberPaidConsumable: integer('isMemberPaidConsumable', {
      mode: 'boolean',
    }).notNull(),
    affectedAreaIdsJson: text('affectedAreaIdsJson').notNull(),
    healthAndSafetyRisk: integer('healthAndSafetyRisk', {
      mode: 'boolean',
    }).notNull(),
    // The proposal as JSON, when the request needs one.
    proposalJson: text('proposalJson'),
    // Awaiting approval until a super user approves or declines it.
    status: text('status').notNull().$type<PurchaseRequestStatus>(),
    decidedAt: integer('decidedAt', {mode: 'timestamp_ms'}),
    decidedByMemberNumber: integer('decidedByMemberNumber'),
    declineReason: text('declineReason'),
    outcome: text('outcome').notNull().$type<PurchaseRequestOutcome>(),
    approval: text('approval').notNull().$type<PurchaseApproval>(),
    outcomeReason: text('outcomeReason').notNull(),
    yearlyBudgetPence: integer('yearlyBudgetPence').notNull(),
    spentThisYearPence: integer('spentThisYearPence').notNull(),
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

export const trainingQuizCompletionsTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS trainingQuizCompletions (
      rowHash TEXT PRIMARY KEY,
      trainingSheetId TEXT NOT NULL,
      completedAt INTEGER NOT NULL,
      memberNumberProvided INTEGER,
      emailProvided TEXT,
      score INTEGER NOT NULL,
      maxScore INTEGER NOT NULL
    )
  `,
  'trainingQuizCompletions' as const,
  {
    rowHash: text('rowHash').primaryKey(),
    trainingSheetId: text('trainingSheetId').notNull(),
    completedAt: integer('completedAt', {mode: 'timestamp'}).notNull(),
    memberNumberProvided: integer('memberNumberProvided'),
    emailProvided: text('emailProvided'),
    score: integer('score').notNull(),
    maxScore: integer('maxScore').notNull(),
  }
);

// Lookups query completions by equipment (via trainingSheetId) and by member
// number; without these the read model would scan the whole table each time.
// Added as raw statements because the read model creates tables from createTables
// (the drizzle index metadata above is not what builds the schema here).
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS trainingQuizCompletions_trainingSheetId_idx ON trainingQuizCompletions (trainingSheetId);`
);
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS trainingQuizCompletions_memberNumberProvided_idx ON trainingQuizCompletions (memberNumberProvided);`
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
      areaId TEXT,
      mailboxConversationId TEXT,
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
    // Resolved equipment record; null means no specific machine matched.
    equipmentId: text('equipmentId').$type<UUID>(),
    // Directly-resolved area, for tickets that matched an area name/alias but
    // no equipment. equipmentId wins when both are set. Both null = Unassigned.
    areaId: text('areaId').$type<UUID>(),
    // The mailbox conversation the ticket was raised from, when it was.
    mailboxConversationId: text('mailboxConversationId'),
    responseJson: text('responseJson', {mode: 'json'})
      .notNull()
      .$type<TroubleTicketResponse>(),
  }
);

// Lookups query tickets by equipment and by status; without these the read
// model would scan the whole table each time. Added as raw statements because
// the read model creates tables from createTables (the drizzle index metadata
// above is not what builds the schema here).
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS troubleTickets_equipmentId_idx ON troubleTickets (equipmentId);`
);
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS troubleTickets_status_idx ON troubleTickets (status);`
);
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS troubleTickets_areaId_idx ON troubleTickets (areaId);`
);

// Row hashes of TroubleTicketCreated events that have been soft-deleted. Kept
// so ingest dedup still recognises the cached sheet row - without this,
// deleting a ticket event (e.g. for a data-removal request) would be undone on
// the next sync cycle, which would re-import the same row as a fresh event.
export const deletedTroubleTicketRowHashesTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS deletedTroubleTicketRowHashes (
      rowHash TEXT PRIMARY KEY
    )
  `,
  'deletedTroubleTicketRowHashes' as const,
  {
    rowHash: text('rowHash').primaryKey(),
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
    uniqueAssignee: uniqueIndex(
      'trouble_ticket_assignees_ticket_user_unique'
    ).on(table.ticketId, table.userId),
  })
);

// One row per ticket status-change event, so the board can render change
// logs without querying the remote event store on every page load. Keyed by
// the source event's index for idempotent re-projection.
export const troubleTicketChangeLogTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS troubleTicketChangeLog (
      eventIndex INTEGER PRIMARY KEY,
      ticketId TEXT NOT NULL,
      at INTEGER NOT NULL,
      actorJson TEXT NOT NULL,
      eventType TEXT NOT NULL,
      detailsJson TEXT NOT NULL
    )
  `,
  'troubleTicketChangeLog' as const,
  {
    eventIndex: integer('eventIndex').primaryKey(),
    ticketId: text('ticketId').notNull().$type<UUID>(),
    at: integer('at', {mode: 'timestamp_ms'}).notNull(),
    actorJson: text('actorJson').notNull(),
    eventType: text('eventType').notNull(),
    detailsJson: text('detailsJson').notNull(),
  }
);

createTables.push(
  sql`CREATE INDEX IF NOT EXISTS troubleTicketChangeLog_ticketId_idx ON troubleTicketChangeLog (ticketId);`
);

// Member page loads and every page's chrome fetch one member's numbers,
// emails, training records and ownership; the areas page fetches equipment
// per area and training rows per machine. SQLite does not index foreign keys
// automatically, so these access paths are what keep member loads and the
// areas page from scanning whole tables per lookup.
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS memberNumbers_userId_idx ON memberNumbers (userId, memberNumber);`
);
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS memberEmails_userId_addedAt_idx ON memberEmails (userId, addedAt);`
);
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS memberFobs_userId_recordedAt_idx ON memberFobs (userId, recordedAt);`
);
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS trainedMembers_userId_idx ON trainedMembers (userId);`
);
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS trainedMembers_equipmentId_trainedAt_idx ON trainedMembers (equipmentId, trainedAt);`
);
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS trainedMembers_trainedByMemberNumber_idx ON trainedMembers (trainedByMemberNumber);`
);
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS trainers_equipmentId_idx ON trainers (equipmentId);`
);
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS owners_userId_idx ON owners (userId);`
);
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS owners_areaId_idx ON owners (areaId);`
);
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS equipment_areaId_idx ON equipment (areaId);`
);
createTables.push(
  sql`CREATE INDEX IF NOT EXISTS purchaseRequests_area_year_idx ON purchaseRequests (purchasingAreaId, budgetYear);`
);

// Event indices of status changes whose notification emails have been sent.
export const troubleTicketNotificationsTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS troubleTicketNotifications (
      notifiedEventIndex INTEGER PRIMARY KEY,
      recipientsJson TEXT NOT NULL
    )
  `,
  'troubleTicketNotifications' as const,
  {
    notifiedEventIndex: integer('notifiedEventIndex').primaryKey(),
    // Who was told, as a JSON list of addresses.
    recipientsJson: text('recipientsJson').notNull(),
  }
);

// Admin-authored site notifications (banners), their area targets, and
// per-member dismissals.
export const notificationsTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      bannerType TEXT NOT NULL,
      linkUrl TEXT,
      linkLabel TEXT,
      dismissable INTEGER NOT NULL,
      expiresAt INTEGER,
      targetAllOwners INTEGER NOT NULL,
      emailMarkdown TEXT,
      emailSent INTEGER NOT NULL DEFAULT 0,
      revoked INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL
    )
  `,
  'notifications' as const,
  {
    id: text('id').notNull().primaryKey().$type<UUID>(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    bannerType: text('bannerType').notNull().$type<'action' | 'event' | 'info'>(),
    linkUrl: text('linkUrl'),
    linkLabel: text('linkLabel'),
    dismissable: integer('dismissable', {mode: 'boolean'}).notNull(),
    expiresAt: integer('expiresAt', {mode: 'timestamp_ms'}),
    targetAllOwners: integer('targetAllOwners', {mode: 'boolean'}).notNull(),
    emailMarkdown: text('emailMarkdown'),
    emailSent: integer('emailSent', {mode: 'boolean'}).notNull(),
    revoked: integer('revoked', {mode: 'boolean'}).notNull(),
    createdAt: integer('createdAt', {mode: 'timestamp_ms'}).notNull(),
  }
);

export const notificationAreaTargetsTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS notificationAreaTargets (
      notificationId TEXT NOT NULL,
      areaId TEXT NOT NULL,
      UNIQUE(notificationId, areaId)
    )
  `,
  'notificationAreaTargets' as const,
  {
    notificationId: text('notificationId').notNull().$type<UUID>(),
    areaId: text('areaId').notNull().$type<UUID>(),
  },
  table => ({
    uniqueTarget: uniqueIndex('notification_area_targets_unique').on(
      table.notificationId,
      table.areaId
    ),
  })
);

export const notificationDismissalsTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS notificationDismissals (
      notificationId TEXT NOT NULL,
      memberNumber INTEGER NOT NULL,
      UNIQUE(notificationId, memberNumber)
    )
  `,
  'notificationDismissals' as const,
  {
    notificationId: text('notificationId').notNull().$type<UUID>(),
    memberNumber: integer('memberNumber').notNull(),
  },
  table => ({
    uniqueDismissal: uniqueIndex('notification_dismissals_unique').on(
      table.notificationId,
      table.memberNumber
    ),
  })
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

// Gmail message ids of the conversations a manager has archived. Opaque ids
// only - the messages themselves live in the external-state cache. A
// conversation is archived when any of its messages is here.
export const mailboxArchivedMessagesTable = defineTable(
  sql`
    CREATE TABLE IF NOT EXISTS mailboxArchivedMessages (
      gmailMessageId TEXT PRIMARY KEY,
      reason TEXT NOT NULL,
      archivedAt INTEGER NOT NULL
    )
  `,
  'mailboxArchivedMessages' as const,
  {
    gmailMessageId: text('gmailMessageId').notNull().primaryKey(),
    reason: text('reason').notNull().$type<MailboxArchiveReason>(),
    archivedAt: integer('archivedAt', {mode: 'timestamp_ms'}).notNull(),
  }
);
