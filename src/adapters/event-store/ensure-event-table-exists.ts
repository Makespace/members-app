import {QueryEventsDatabase} from './query-events-database';

export const ensureEventTableExists = (queryDatabase: QueryEventsDatabase) =>
  queryDatabase(
    `
    CREATE TABLE IF NOT EXISTS events (
      id varchar(255),
      resource_id varchar(255),
      resource_type varchar(255),
      event_type varchar(255),
      payload json
    );
  `,
    []
  );
