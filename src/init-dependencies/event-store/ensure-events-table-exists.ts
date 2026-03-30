import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import {failure} from '../../types';
import {dbExecute} from '../../util';
import {pipe} from 'fp-ts/lib/function';

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
    TE.chain(() =>
      TE.tryCatch(
        () =>
          dbExecute(
            eventDB,
            `
            CREATE TABLE IF NOT EXISTS deleted_events (
              event_id TEXT NOT NULL UNIQUE,
              deleted_at TEXT NOT NULL,
              deleted_by_member_number INTEGER NOT NULL,
              deletion_reason TEXT NOT NULL
            );
            `,
            {}
          ),
        failure('Deleted events table does not exist and could not be created')
      )
    )
  );
