import {createHash} from 'crypto';

export type TroubleTicketRowHashInput = {
  sheetId: string;
  submittedAt: Date;
  submittedEmail: string | null;
  submittedMemberNumber: number | null;
  submittedEquipment: string | null;
  // The exact `submitted_response_json` string from the cache row.
  responseJson: string;
};

// A stable dedup key for a single form submission. Deliberately excludes `row_index`
// (rows shift if the sheet is edited) and `cached_at` (changes every sync); it is derived
// only from the submission's own facts, so re-ingesting the same row yields the same hash.
export const troubleTicketRowHash = (input: TroubleTicketRowHashInput): string =>
  createHash('sha256')
    .update(
      JSON.stringify([
        input.sheetId,
        input.submittedAt.toISOString(),
        input.submittedEmail ?? '',
        input.submittedMemberNumber ?? '',
        input.submittedEquipment ?? '',
        input.responseJson,
      ])
    )
    .digest('hex');
