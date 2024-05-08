import {LegacyQueryEventsDatabase} from './legacy-query-events-database';

export const legacyEnsureEventTableExists = (
  queryDatabase: LegacyQueryEventsDatabase
) =>
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
