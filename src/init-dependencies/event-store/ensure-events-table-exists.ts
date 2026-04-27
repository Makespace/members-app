import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import {failure} from '../../types';
import {dbExecute} from '../../util';
import {pipe} from 'fp-ts/lib/function';

const ensureDeletedEventsTableExists = (eventDB: Client) =>
  TE.tryCatch(
    () =>
      dbExecute(
        eventDB,
        `
        CREATE TABLE IF NOT EXISTS deleted_events (
          event_index INTEGER NOT NULL UNIQUE,
          deleted_at TEXT NOT NULL
        );
        `,
        {}
      ).then(() => undefined),
    failure('Failed to create deleted_events table')
  );

const migrateDeletedAtColumnIntoDeletedEventsTable = (eventDB: Client) =>
  pipe(
    TE.tryCatch(
      () => dbExecute(eventDB, 'PRAGMA table_info(events);', {}),
      failure('Failed to inspect events table')
    ),
    TE.chain(result =>
      result.rows.some(row => row['name'] === 'deleted_at')
        ? TE.tryCatch(
            () =>
              dbExecute(
                eventDB,
                `
                INSERT OR IGNORE INTO deleted_events (event_index, deleted_at)
                SELECT event_index, deleted_at
                FROM events
                WHERE deleted_at IS NOT NULL;
                `,
                {}
              ).then(() => undefined),
            failure('Failed to migrate deleted events into deleted_events table')
          )
        : TE.right(undefined)
    )
  );

export const ensureEventTableExists = (eventDB: Client) =>
  pipe(
    TE.tryCatch(
      () =>
        dbExecute(
          eventDB,
          `
          CREATE TABLE IF NOT EXISTS events (
            id TEXT,
            event_index number integer NOT NULL UNIQUE,
            resource_version number,
            resource_id TEXT,
            resource_type TEXT,
            event_type TEXT,
            payload TEXT
          );
          `,
          {}
        ),
      failure('Event table does not exist and could not be created')
    ),
    TE.chain(() => ensureDeletedEventsTableExists(eventDB)),
    TE.chain(() => migrateDeletedAtColumnIntoDeletedEventsTable(eventDB))
  );
