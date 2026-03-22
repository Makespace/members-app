import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import {failure} from '../../types';
import {dbExecute} from '../../util';
import { pipe } from 'fp-ts/lib/function';

export const ensureEventTableExists = (eventDB: Client) =>
  pipe(
    TE.tryCatch(
      () =>
        dbExecute(
          eventDB,
          `
          CREATE TABLE IF NOT EXISTS events (
            id TEXT,
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
    TE.chain(
      (_) => TE.tryCatch(
        () =>
        dbExecute(
          eventDB,
          `
          CREATE TABLE IF NOT EXISTS events_exclusions (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            reverted_by_member_number INTEGER NOT NULL,
            revert_reason TEXT NOT NULL,
            reverted_at_timestamp_epoch_ms INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS events_exclusions_event_id_idx
          ON events_exclusions (event_id);
          `,
          {}
        ),
        failure('Event exclusion table does not exist and could not be created')
      )
    )
  )
  ;
