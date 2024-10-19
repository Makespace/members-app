import * as T from 'fp-ts/Task';
import * as O from 'fp-ts/Option';
import {createTables} from './state';
import {BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import {getAllMember, getMember, getMemberAsActor} from './get-member';
import {Area, Equipment, Member} from './return-types';
import {getAllEquipment, getEquipment} from './get-equipment';
import {Client} from '@libsql/client/.';
import {asyncRefresh} from './async-refresh';
import {updateState} from './update-state';
import {Logger} from 'pino';
import {asyncApplyExternalEventSources} from './async-apply-external-event-sources';
import {UUID} from 'io-ts-types';
import {GoogleHelpers} from '../../init-dependencies/google/pull_sheet_data';
import {User} from '../../types';
import {getAllArea, getArea} from './get-area';

export {replayState} from './deprecated-replay';

export type SharedReadModel = {
  db: BetterSQLite3Database;
  asyncRefresh: () => T.Task<void>;
  asyncApplyExternalEventSources: () => T.Task<void>;
  members: {
    get: (memberNumber: number) => O.Option<Member>;
    getAll: () => ReadonlyArray<Member>;
    getAsActor: (user: User) => (memberNumber: number) => O.Option<Member>;
  };
  equipment: {
    get: (id: UUID) => O.Option<Equipment>;
    getAll: () => ReadonlyArray<Equipment>;
  };
  area: {
    get: (id: UUID) => O.Option<Area>;
    getAll: () => ReadonlyArray<Area>;
  };
};

export const initSharedReadModel = (
  eventStoreClient: Client,
  logger: Logger,
  googleHelpers: O.Option<GoogleHelpers>,
  googleRateLimitMs: number
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
      googleHelpers,
      updateState_,
      googleRateLimitMs
    ),
    members: {
      get: getMember(readModelDb),
      getAll: getAllMember(readModelDb),
      getAsActor: getMemberAsActor(readModelDb),
    },
    equipment: {
      get: getEquipment(readModelDb),
      getAll: getAllEquipment(readModelDb),
    },
    area: {
      get: getArea(readModelDb),
      getAll: getAllArea(readModelDb),
    },
  };
};
