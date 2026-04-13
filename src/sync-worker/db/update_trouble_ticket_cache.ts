import {Client, InStatement} from '@libsql/client';
import {SyncWorkerDependencies} from '../dependencies';

export const updateTroubleTicketCache =
  (googleDB: Client): SyncWorkerDependencies['updateTroubleTicketCache'] =>
  async (sheetId, data) => {
    const insertStatements: InStatement[] = data.map(row => ({
      sql: `
        INSERT INTO trouble_ticket_data (
          sheet_id,
          sheet_name,
          row_index,
          response_submitted,
          cached_at,
          submitted_email,
          submitted_equipment,
          submitted_name,
          submitted_membership_number,
          submitted_response_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        row.sheet_id,
        row.sheet_name,
        row.row_index,
        row.response_submitted,
        row.cached_at,
        row.submitted_email,
        row.submitted_equipment,
        row.submitted_name,
        row.submitted_membership_number,
        row.submitted_response_json,
      ],
    }));
    await googleDB.batch(
      [
        {
          sql: 'DELETE FROM trouble_ticket_data WHERE sheet_id = ?',
          args: [sheetId],
        },
        ...insertStatements,
      ],
      'write'
    );
  };
