import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {desc, eq, inArray, isNull} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {UUID} from 'io-ts-types';
import {
  deletedTroubleTicketRowHashesTable,
  troubleTicketAssigneesTable,
  troubleTicketChangeLogTable,
  troubleTicketNotificationsTable,
  troubleTicketsTable,
} from '../state';
import {TroubleTicket} from '../../../types/trouble-ticket';
import {Actor} from '../../../types/actor';

// One board change-log entry, decoded from the projection.
export type TroubleTicketChangeRow = {
  ticketId: UUID;
  at: Date;
  actor: Actor;
  eventType: string;
  details: Record<string, string>;
};

// Change-log rows for the given tickets, oldest first. Reads the in-memory
// projection - no event-store round trips on the page's hot path.
export const getTroubleTicketChangeLog =
  (db: BetterSQLite3Database) =>
  (ticketIds: ReadonlyArray<UUID>): ReadonlyArray<TroubleTicketChangeRow> => {
    if (ticketIds.length === 0) {
      return [];
    }
    return db
      .select()
      .from(troubleTicketChangeLogTable)
      .where(inArray(troubleTicketChangeLogTable.ticketId, [...ticketIds]))
      .orderBy(troubleTicketChangeLogTable.eventIndex)
      .all()
      .map(row => ({
        ticketId: row.ticketId,
        at: row.at,
        actor: JSON.parse(row.actorJson) as Actor,
        eventType: row.eventType,
        details: JSON.parse(row.detailsJson) as Record<string, string>,
      }));
  };

type Row = typeof troubleTicketsTable.$inferSelect;

// Assigned trainer member numbers, keyed by ticket id, for the given tickets.
const assigneesByTicket = (
  db: BetterSQLite3Database,
  ticketIds: ReadonlyArray<UUID>
): ReadonlyMap<string, ReadonlyArray<number>> => {
  if (ticketIds.length === 0) {
    return new Map();
  }
  const rows = db
    .select({
      ticketId: troubleTicketAssigneesTable.ticketId,
      memberNumber: troubleTicketAssigneesTable.memberNumber,
    })
    .from(troubleTicketAssigneesTable)
    .where(inArray(troubleTicketAssigneesTable.ticketId, [...ticketIds]))
    .all();
  const map = new Map<string, number[]>();
  for (const row of rows) {
    const existing = map.get(row.ticketId) ?? [];
    existing.push(row.memberNumber);
    map.set(row.ticketId, existing);
  }
  return map;
};

const transformRow =
  (assignees: ReadonlyMap<string, ReadonlyArray<number>>) =>
  (row: Row): TroubleTicket => ({
    id: row.id,
    status: row.status,
    title: row.title,
    submittedAt: row.submittedAt,
    submittedName: row.submittedName,
    submittedMemberNumber: row.submittedMemberNumber,
    submittedEmail: row.submittedEmail,
    submittedEquipment: row.submittedEquipment,
    equipmentId: row.equipmentId ?? null,
    areaId: row.areaId ?? null,
    mailboxConversationId: row.mailboxConversationId ?? null,
    assignedMemberNumbers: assignees.get(row.id) ?? [],
    response: row.responseJson,
  });

const withAssignees = (
  db: BetterSQLite3Database,
  rows: ReadonlyArray<Row>
): ReadonlyArray<TroubleTicket> => {
  const assignees = assigneesByTicket(
    db,
    rows.map(r => r.id)
  );
  return pipe(rows, RA.map(transformRow(assignees)));
};

// Whether change-notification emails have already been sent for the
// status-change event at the given event index.
export const hasNotifiedForEvent =
  (db: BetterSQLite3Database) =>
  (eventIndex: number): boolean =>
    db
      .select({i: troubleTicketNotificationsTable.notifiedEventIndex})
      .from(troubleTicketNotificationsTable)
      .where(eq(troubleTicketNotificationsTable.notifiedEventIndex, eventIndex))
      .get() !== undefined;

// True if the row has ever been imported - including tickets whose event has
// since been soft-deleted. Deleted tickets must stay deleted: if this returned
// false for them, the ingest would re-import the same cached sheet row.
export const hasTroubleTicketRowHash =
  (db: BetterSQLite3Database) =>
  (rowHash: string): boolean =>
    db
      .select({rowHash: troubleTicketsTable.rowHash})
      .from(troubleTicketsTable)
      .where(eq(troubleTicketsTable.rowHash, rowHash))
      .get() !== undefined ||
    db
      .select({rowHash: deletedTroubleTicketRowHashesTable.rowHash})
      .from(deletedTroubleTicketRowHashesTable)
      .where(eq(deletedTroubleTicketRowHashesTable.rowHash, rowHash))
      .get() !== undefined;

export const getAllTroubleTickets =
  (db: BetterSQLite3Database) => (): ReadonlyArray<TroubleTicket> =>
    withAssignees(
      db,
      db
        .select()
        .from(troubleTicketsTable)
        .orderBy(desc(troubleTicketsTable.submittedAt))
        .all()
    );

export const getTroubleTicketById =
  (db: BetterSQLite3Database) =>
  (id: UUID): O.Option<TroubleTicket> =>
    pipe(
      db
        .select()
        .from(troubleTicketsTable)
        .where(eq(troubleTicketsTable.id, id))
        .get(),
      O.fromNullable,
      O.map(row => withAssignees(db, [row])[0])
    );

// The tickets raised from one mailbox conversation, newest first - so the
// conversation can show what it has already led to.
export const getTroubleTicketsByMailboxConversation =
  (db: BetterSQLite3Database) =>
  (conversationId: string): ReadonlyArray<TroubleTicket> =>
    withAssignees(
      db,
      db
        .select()
        .from(troubleTicketsTable)
        .where(eq(troubleTicketsTable.mailboxConversationId, conversationId))
        .orderBy(desc(troubleTicketsTable.submittedAt))
        .all()
    );

// Passing null returns the "Unassigned" bucket (tickets whose equipment could
// not be resolved).
export const getTroubleTicketsByEquipment =
  (db: BetterSQLite3Database) =>
  (equipmentId: UUID | null): ReadonlyArray<TroubleTicket> =>
    withAssignees(
      db,
      db
        .select()
        .from(troubleTicketsTable)
        .where(
          equipmentId === null
            ? isNull(troubleTicketsTable.equipmentId)
            : eq(troubleTicketsTable.equipmentId, equipmentId)
        )
        .orderBy(desc(troubleTicketsTable.submittedAt))
        .all()
    );
