import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {desc, eq, inArray, isNull} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {UUID} from 'io-ts-types';
import {troubleTicketAssigneesTable, troubleTicketsTable} from '../state';
import {TroubleTicket} from '../../../types/trouble-ticket';

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

export const hasTroubleTicketRowHash =
  (db: BetterSQLite3Database) =>
  (rowHash: string): boolean =>
    db
      .select({rowHash: troubleTicketsTable.rowHash})
      .from(troubleTicketsTable)
      .where(eq(troubleTicketsTable.rowHash, rowHash))
      .get() !== undefined;

export const getAllTroubleTickets =
  (db: BetterSQLite3Database) =>
  (): ReadonlyArray<TroubleTicket> =>
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

// Passing null returns the "Unassigned" bucket (tickets whose equipment could not be
// resolved).
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
