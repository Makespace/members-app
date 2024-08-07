import * as T from 'fp-ts/Task';
import * as O from 'fp-ts/Option';
import {createTables} from './state';
import {BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import {getMember} from './get-member';
import {Equipment, Member} from './return-types';
import {getEquipment} from './get-equipment';
import {Client} from '@libsql/client/.';
import {asyncRefresh} from './async-refresh';
import {updateState} from './update-state';

export {replayState} from './deprecated-replay';

export type SharedReadModel = {
  db: BetterSQLite3Database;
  asyncRefresh: () => T.Task<void>;
  members: {
    get: (memberNumber: number) => O.Option<Member>;
  };
  equipment: {
    get: (id: string) => O.Option<Equipment>;
  };
};

export const initSharedReadModel = (
  eventStoreClient: Client
): SharedReadModel => {
  const readModelDb = drizzle(new Database());
  createTables.forEach(statement => readModelDb.run(statement));
  return {
    db: readModelDb,
    asyncRefresh: asyncRefresh(eventStoreClient, updateState(readModelDb)),
    members: {
      get: getMember(readModelDb),
    },
    equipment: {
      get: getEquipment(readModelDb),
    },
  };
};
