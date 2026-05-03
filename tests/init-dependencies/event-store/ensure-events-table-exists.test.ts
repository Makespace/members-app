import * as libsqlClient from '@libsql/client';
import {ensureEventTableExists} from '../../../src/init-dependencies/event-store/ensure-events-table-exists';
import {dbExecute} from '../../../src/util';
import {getRightOrFail} from '../../helpers';

describe('ensure-events-table-exists', () => {
  let dbClient: libsqlClient.Client;

  beforeEach(() => {
    dbClient = libsqlClient.createClient({url: ':memory:'});
  });

  afterEach(() => {
    dbClient.close();
  });

  it('creates the deleted_events table', async () => {
    getRightOrFail(await ensureEventTableExists(dbClient)());

    await expect(
      dbExecute(
        dbClient,
        `
        INSERT INTO deleted_events (event_index, deleted_at_unix_ms)
        VALUES (?, ?);
        `,
        [1, Date.now()]
      )
    ).resolves.toEqual(expect.anything());
  });
});
