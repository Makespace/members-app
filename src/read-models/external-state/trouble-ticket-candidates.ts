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

// Reads the cached trouble-ticket rows and maps each to the event that would be
// created. Read-only - no events are written.
export const getTroubleTicketCandidates = async (
  extDB: ExternalStateDB
): Promise<ReadonlyArray<CandidateTroubleTicket>> => {
  const rows = await extDB.select().from(troubleTicketDataTable);

  return rows.map(row => {
    const response = parseResponseJson(row.submitted_response_json);
    return {
      sheetId: row.sheet_id,
      submittedAt: row.response_submitted,
      submittedMemberNumber: row.submitted_membership_number,
      submittedEmail: row.submitted_email,
      submittedName: row.submitted_name,
      submittedEquipment: row.submitted_equipment,
      response,
      rowHash: troubleTicketRowHash({
        sheetId: row.sheet_id,
        submittedAt: row.response_submitted,
        submittedEmail: row.submitted_email,
        submittedMemberNumber: row.submitted_membership_number,
        submittedEquipment: row.submitted_equipment,
        response,
      }),
    };
  });
};
