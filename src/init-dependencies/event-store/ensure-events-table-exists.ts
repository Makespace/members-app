import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import {failure} from '../../types';
import {dbExecute} from '../../util';

export const ensureEventTableExists = (eventDB: Client) =>
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
  );
