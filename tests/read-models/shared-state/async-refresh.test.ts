import * as libsqlClient from '@libsql/client';
import {Logger} from 'pino';
import {asyncRefresh} from '../../../src/read-models/shared-state/async-refresh';
import {ensureEventTableExists} from '../../../src/init-dependencies/event-store/ensure-events-table-exists';
import {getRightOrFail} from '../../helpers';

describe('asyncRefresh', () => {
  it('logs structured fetch and projection timings', async () => {
    const eventStoreDb = libsqlClient.createClient({url: ':memory:'});
    const logger = {info: jest.fn()} as unknown as Logger;
    const getCurrentEventIndex = jest.fn(() => 0);
    const updateState = jest.fn();
    getRightOrFail(await ensureEventTableExists(eventStoreDb)());

    await asyncRefresh(
      eventStoreDb,
      getCurrentEventIndex,
      updateState,
      logger
    )()();

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCount: 0,
        startEventIndex: 0,
        endEventIndex: 0,
      }),
      'Read model refresh completed'
    );
    expect(updateState).not.toHaveBeenCalled();
    eventStoreDb.close();
  });
});
