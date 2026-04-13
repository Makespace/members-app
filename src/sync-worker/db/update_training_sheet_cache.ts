import {Client, InStatement} from '@libsql/client';
import {SyncWorkerDependencies} from '../dependencies';

export const updateTrainingSheetCache =
  (
    googleDB: Client
  ): SyncWorkerDependencies['updateTrainingSheetCache'] =>
  async (sheetId, newData) => {
    const insertStatements: InStatement[] = newData.map(row => ({
      sql: `
        INSERT INTO sheet_data (
          sheet_id,
          sheet_name,
          row_index,
          response_submitted,
          member_number_provided,
          email_provided,
          score,
          max_score,
          percentage,
          cached_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        row.sheet_id,
        row.sheet_name,
        row.row_index,
        row.response_submitted,
        row.member_number_provided,
        row.email_provided,
        row.score,
        row.max_score,
        row.percentage,
        row.cached_at,
      ],
    }));
    await googleDB.batch(
      [
        {sql: 'DELETE FROM sheet_data WHERE sheet_id = ?', args: [sheetId]},
        ...insertStatements,
      ],
      'write'
    );
  };
