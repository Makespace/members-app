import {QueryEventsDatabase} from './query-events-database';

export const ensureEventTableExists = (queryDatabase: QueryEventsDatabase) =>
  queryDatabase(
    `
    CREATE TABLE IF NOT EXISTS events (
      id TEXT,
      resource_id TEXT,
      resource_type TEXT,
      event_type TEXT,
      payload TEXT
    );
  `,
    []
  );
