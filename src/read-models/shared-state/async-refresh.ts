/* eslint-disable unused-imports/no-unused-vars */
import {Client} from '@libsql/client/.';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {createTables} from './state';
import {getAllEvents} from '../../init-dependencies/event-store/get-all-events';
import {getRightOrFail} from '../../../tests/helpers';
import {pipe} from 'fp-ts/lib/function';
import * as T from 'fp-ts/Task';
import {DomainEvent} from '../../types';

export const asyncRefresh = (
  eventStoreDb: Client,
  readModelDb: BetterSQLite3Database,
  updateState: (event: DomainEvent) => void
) => {
  let knownEvents = 0;
  return () => async () => {
    const events = await pipe(
      getAllEvents(eventStoreDb)(),
      T.map(getRightOrFail)
    )();
    if (knownEvents === 0) {
      createTables.forEach(statement => readModelDb.run(statement));
    }
    if (events.length > knownEvents) {
      events.forEach(updateState);
      knownEvents = events.length;
    }
  };
};
