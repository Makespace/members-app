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
