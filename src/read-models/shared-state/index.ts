import * as T from 'fp-ts/Task';
import * as O from 'fp-ts/Option';
import {createTables} from './state';
import {BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import {getMember} from './get-member';
import {Equipment, Member} from './return-types';
import {getAllEquipment, getEquipment} from './get-equipment';
import {Client} from '@libsql/client/.';
import {asyncRefresh} from './async-refresh';
import {updateState} from './update-state';
import {Logger} from 'pino';
import {
  asyncApplyExternalEventSources,
  PullSheetData,
} from './async-apply-external-event-sources';

export {replayState} from './deprecated-replay';

export type SharedReadModel = {
  db: BetterSQLite3Database;
  asyncRefresh: () => T.Task<void>;
  asyncApplyExternalEventSources: () => T.Task<void>;
  members: {
    get: (memberNumber: number) => O.Option<Member>;
  };
  equipment: {
    get: (id: string) => O.Option<Equipment>;
    getAll: () => ReadonlyArray<Equipment>;
  };
};

export const initSharedReadModel = (
  eventStoreClient: Client,
  logger: Logger,
  pullGoogleSheetData: PullSheetData
): SharedReadModel => {
  const readModelDb = drizzle(new Database());
  createTables.forEach(statement => readModelDb.run(statement));
  const updateState_ = updateState(readModelDb);

  return {
    db: readModelDb,
    asyncRefresh: asyncRefresh(eventStoreClient, updateState_),
    asyncApplyExternalEventSources: asyncApplyExternalEventSources(
      logger,
      readModelDb,
      pullGoogleSheetData,
      updateState_
    ),
    members: {
      get: getMember(readModelDb),
    },
    equipment: {
      get: getEquipment(readModelDb),
      getAll: getAllEquipment(readModelDb),
    },
  };
};
