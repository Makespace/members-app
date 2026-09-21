import {sql} from 'drizzle-orm';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {troubleTicketDataTable} from '../../sync-worker/google/sheet-data-table';
import {TroubleTicketResponse} from '../../types/trouble-ticket';
import {parseResponseJson} from '../../trouble-tickets/parse-response';
import {troubleTicketRowHash} from '../../trouble-tickets/row-hash';

// The event we would create from one cached trouble-ticket row. Raw sheet facts
// only - member and equipment resolution happen downstream. Shared by the
// going-forward ingest and the one-time timeline backfill so both derive
// identical rowHashes.
type CandidateTroubleTicket = {
  sheetId: string;
  submittedAt: Date; // the historical submission time (goes in the event, not recordedAt)
  submittedMemberNumber: number | null;
  submittedEmail: string | null;
  submittedName: string | null;
  submittedEquipment: string | null;
  response: TroubleTicketResponse;
  rowHash: string; // stable dedup key
};

type TroubleTicketCandidates = {
  candidates: ReadonlyArray<CandidateTroubleTicket>;
  // Cache rows with no usable submission timestamp (NULL or invalid). The
  // current sync worker validates timestamps before caching, but older code
  // versions and abandoned sheet ids can leave such rows behind, and the
  // per-sheet cache replacement never cleans them up. They cannot become
  // events (no time to weave them in at, and no stable hash), so they are
  // skipped and counted rather than crashing the whole run.
  skippedNoTimestamp: number;
};

// Diagnostics for judging what the candidate reader is skipping and whether
// the cache holds data in unexpected formats: a breakdown of the timestamp
// column's SQLite storage classes across ALL rows (definitive, no sampling
// bias), and a sample of the NULL-timestamp rows with enough identity
// (sheet id, row index, cache date) to tell which era/sheet they came from.
export type TroubleTicketCacheDiagnostics = {
  timestampStorageBreakdown: Record<string, number>;
  nullTimestampSample: ReadonlyArray<{
    sheetId: string;
    rowIndex: number;
    cachedAt: string | null;
  }>;
};

export const getTroubleTicketCacheDiagnostics = async (
  extDB: ExternalStateDB,
  limit = 10
): Promise<TroubleTicketCacheDiagnostics> => {
  const breakdown = await extDB.all<{stored_type: string; n: number}>(
    sql`SELECT typeof(response_submitted) AS stored_type, count(*) AS n
        FROM trouble_ticket_data
        GROUP BY typeof(response_submitted)`
  );
  const nullRows = await extDB.all<{
    sheet_id: string;
    row_index: number;
    cached_at: string | number | null;
  }>(
    sql`SELECT sheet_id, row_index, CAST(cached_at AS TEXT) AS cached_at
        FROM trouble_ticket_data
        WHERE response_submitted IS NULL
        LIMIT ${limit}`
  );
  return {
    timestampStorageBreakdown: Object.fromEntries(
      breakdown.map(row => [row.stored_type, Number(row.n)])
    ),
    nullTimestampSample: nullRows.map(row => ({
      sheetId: row.sheet_id,
      rowIndex: row.row_index,
      cachedAt: row.cached_at === null ? null : String(row.cached_at),
    })),
  };
};

// Reads the cached trouble-ticket rows and maps each to the event that would be
// created. Read-only - no events are written.
export const getTroubleTicketCandidates = async (
  extDB: ExternalStateDB
): Promise<TroubleTicketCandidates> => {
  const rows = await extDB.select().from(troubleTicketDataTable);

  let skippedNoTimestamp = 0;
  const candidates = rows.flatMap(row => {
    // The DDL has no NOT NULL on response_submitted, so distrust the drizzle
    // type: a NULL (or out-of-range) stored value must not crash the reader.
    const submittedAt = row.response_submitted as Date | null;
    if (submittedAt === null || !Number.isFinite(submittedAt.getTime())) {
      skippedNoTimestamp++;
      return [];
    }
    const response = parseResponseJson(row.submitted_response_json);
    return [
      {
        sheetId: row.sheet_id,
        submittedAt,
        submittedMemberNumber: row.submitted_membership_number,
        submittedEmail: row.submitted_email,
        submittedName: row.submitted_name,
        submittedEquipment: row.submitted_equipment,
        response,
        rowHash: troubleTicketRowHash({
          sheetId: row.sheet_id,
          submittedAt,
          submittedEmail: row.submitted_email,
          submittedMemberNumber: row.submitted_membership_number,
          submittedEquipment: row.submitted_equipment,
          response,
        }),
      },
    ];
  });

  return {candidates, skippedNoTimestamp};
};
