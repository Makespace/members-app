import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import {failure} from '../../types';
import {dbExecute} from '../../util';

export const ensureEventTableExists = (eventDB: Client) =>
  TE.tryCatch(
    async () => {
      await dbExecute(
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
      );
      await dbExecute(
        eventDB,
        `
        CREATE TABLE IF NOT EXISTS deleted_events (
          event_id TEXT PRIMARY KEY,
          deleted_at TEXT NOT NULL,
          deleted_by TEXT NOT NULL,
          reason TEXT NOT NULL
        );
        `,
        {}
      );
    },
    failure('Event table does not exist and could not be created')
  );
