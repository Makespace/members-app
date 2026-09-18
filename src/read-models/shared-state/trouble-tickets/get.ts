import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {desc, eq} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {UUID} from 'io-ts-types';
import {
  deletedTroubleTicketRowHashesTable,
  troubleTicketsTable,
} from '../state';
import {TroubleTicket} from '../../../types/trouble-ticket';

type Row = typeof troubleTicketsTable.$inferSelect;

const transformRow = (row: Row): TroubleTicket => ({
  id: row.id,
  status: row.status,
  title: row.title,
  submittedAt: row.submittedAt,
  submittedName: row.submittedName,
  submittedMemberNumber: row.submittedMemberNumber,
  submittedEmail: row.submittedEmail,
  submittedEquipment: row.submittedEquipment,
  equipmentId: row.equipmentId ?? null,
  // Assignment arrives with the status workflow; until then no ticket has
  // assignees.
  assignedMemberNumbers: [],
  response: row.responseJson,
});

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
    pipe(
      db
        .select()
        .from(troubleTicketsTable)
        .orderBy(desc(troubleTicketsTable.submittedAt))
        .all(),
      RA.map(transformRow)
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
      O.map(transformRow)
    );
