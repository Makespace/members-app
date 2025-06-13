import * as t from 'io-ts';
import * as tt from 'io-ts-types';

export const SheetDataTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      sheet_id: t.string,
      row_index: t.Integer,
      member_number_provided: t.Integer,
      email_provided: t.string,
      score: t.Integer,
      max_score: t.Integer,
      percentage: t.Integer,
      cached_at: tt.DateFromNumber,
    })
  ),
});
export type SheetDataTable = t.TypeOf<typeof SheetDataTable>;

export const SheetSyncMetadataTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      sheet_id: t.string,
      last_sync: tt.DateFromNumber,
    })
  ),
});
export type SheetSyncMetadataTable = t.TypeOf<typeof SheetSyncMetadataTable>;

export const TroubleTicketDataTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      sheet_id: t.string,
      response_submitted: tt.DateFromNumber,
      cached_at: tt.DateFromNumber,
      // Do not trust provided data - it is not verified.
      submitted_email: t.union([t.string, t.null]),
      submitted_equipment: t.union([t.string, t.null]),
      submitted_name: t.union([t.string, t.null]),
      submitted_membership_number: t.union([t.Integer, t.null]),
      submitted_response_json: t.string,
    })
  ),
});
export type TroubleTicketDataTable = t.TypeOf<typeof TroubleTicketDataTable>;
