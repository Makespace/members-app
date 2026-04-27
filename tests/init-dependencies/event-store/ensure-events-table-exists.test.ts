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
        INSERT INTO deleted_events (event_index, deleted_at)
        VALUES (?, ?);
        `,
        [1, '2026-04-27T12:00:00.000Z']
      )
    ).resolves.toEqual(expect.anything());
  });

  it('migrates deleted_at data from an existing events table', async () => {
    await dbExecute(
      dbClient,
      `
        CREATE TABLE events (
          id TEXT,
          event_index number integer NOT NULL UNIQUE,
          resource_version number,
          resource_id TEXT,
          resource_type TEXT,
          event_type TEXT,
          payload TEXT,
          deleted_at TEXT
        );
      `,
      {}
    );

    await dbExecute(
      dbClient,
      `
      INSERT INTO events (
        id,
        event_index,
        resource_version,
        resource_id,
        resource_type,
        event_type,
        payload,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        'event-1',
        1,
        null,
        null,
        null,
        'AreaCreated',
        '{"type":"AreaCreated","actor":{"tag":"system"},"recordedAt":"2026-04-27T12:00:00.000Z","name":"Area","id":"d1428735-0482-49c4-b16b-82503ccea74b"}',
        '2026-04-27T13:00:00.000Z',
      ]
    );

    getRightOrFail(await ensureEventTableExists(dbClient)());

    await expect(
      dbExecute(
        dbClient,
        'SELECT event_index, deleted_at FROM deleted_events WHERE event_index = ?;',
        [1]
      )
    ).resolves.toMatchObject({
      rows: [
        {
          event_index: 1,
          deleted_at: '2026-04-27T13:00:00.000Z',
        },
      ],
    });
  });
});
