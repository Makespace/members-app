import {createHash} from 'crypto';
import {TroubleTicketResponse} from '../types/trouble-ticket';

export type TroubleTicketRowHashInput = {
  sheetId: string;
  submittedAt: Date;
  submittedEmail: string | null;
  submittedMemberNumber: number | null;
  submittedEquipment: string | null;
  response: TroubleTicketResponse;
};

// The fields are joined with  (an ASCII control byte that can never
// appear in a field value), making the concatenation unambiguous. Never change
// this: it changes every rowHash, and previously imported rows would all be
// re-imported as duplicates.
const SEP = '\u0001';

// A stable dedup key for a single form submission. Deliberately excludes `row_index`
// (rows shift if the sheet is edited) and `cached_at` (changes every sync), and hashes
// the parsed answer *values* rather than the cached `submitted_response_json` string -
// the JSON keys are the sync worker's question strings, which would otherwise become a
// frozen wire format. Known and accepted: null and '' hash identically, and two
// byte-identical submissions in the same second collapse into one ticket.
export const troubleTicketRowHash = (
  input: TroubleTicketRowHashInput
): string =>
  createHash('sha256')
    .update(
      [
        input.sheetId,
        input.submittedAt.getTime().toString(),
        input.submittedEmail ?? '',
        input.submittedMemberNumber?.toString() ?? '',
        input.submittedEquipment ?? '',
        input.response.otherEquipmentDetail,
        input.response.status,
        input.response.attempting,
        input.response.issue,
        input.response.steps,
      ].join(SEP)
    )
    .digest('hex');
