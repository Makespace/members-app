import {Client} from '@libsql/client/.';
import {failure} from '../../types/failure';
import * as TE from 'fp-ts/TaskEither';

const setupVersionsTable = (dbClient: Client) => async () => {
  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS versions (
      resource_version number,
      resource_id TEXT,
      resource_type TEXT
    );
  `);

  const rowCount = await dbClient.execute('SELECT COUNT(*) FROM versions');
  if (rowCount.rows[0]['COUNT(*)'] === 0) {
    const versions = await dbClient.execute(`
        SELECT resource_id, resource_type, MAX(resource_version) AS resource_version
        FROM events
        GROUP BY resource_id, resource_type;
      `);
    const insertRows = versions.rows.map(row => ({
      sql: 'INSERT INTO versions (resource_id, resource_type, resource_version) VALUES ($resource_id, $resource_type, $resource_version); ',
      args: row,
    }));
    await dbClient.batch(insertRows);
  }
};

export const ensureVersionsTableExists = (dbClient: Client) =>
  TE.tryCatch(
    setupVersionsTable(dbClient),
    failure('Could not ensure versions table is populated')
  );
