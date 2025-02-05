import {Client} from '@libsql/client/.';
import * as TE from 'fp-ts/TaskEither';
import {failure} from '../../types';

export const ensureCachedSheetDataTableExists = (dbClient: Client) =>
  TE.tryCatch(
    () =>
      dbClient.execute(`
    CREATE TABLE IF NOT EXISTS cached_sheet_data (
      sheet_id TEXT PRIMARY KEY,
      cache_timestamp timestamp,
      cached_data TEXT
    );
    `),
    failure('Cached sheet data table does not exist and could not be created')
  );
