import * as T from 'fp-ts/Task';
import * as O from 'fp-ts/Option';
import {createTables} from './state';
import {BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import {Area, Equipment, Member, TroubleTicket} from './return-types';

import {Client} from '@libsql/client/.';
import {asyncRefresh} from './async-refresh';
import {updateState} from './update-state';
import {Logger} from 'pino';
import {asyncApplyExternalEventSources} from './async-apply-external-event-sources';
import {UUID} from 'io-ts-types';
import {GoogleHelpers} from '../../init-dependencies/google/pull_sheet_data';
import {User} from '../../types';
import {getAllEquipmentFull, getEquipmentFull} from './equipment/helpers';
import {getAllAreaFull, getAreaFull} from './area/helpers';
import {
  getAllMemberFull,
  getMemberFull,
  getMemberAsActorFull,
} from './member/helper';
import {Dependencies} from '../../dependencies';
import {dumpCurrentState, SharedDatabaseDump} from './debug/dump';
import {getAllTroubleTicketFull} from './troubletickets/get';

export {replayState} from './deprecated-replay';

export type SharedReadModel = {
  db: BetterSQLite3Database;
  _underlyingReadModelDb: Database.Database; // This is exposed only to allow debug serialisation of the db.
  asyncRefresh: () => T.Task<void>;
  asyncApplyExternalEventSources: () => T.Task<void>;
  updateState: ReturnType<typeof updateState>;
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
  debug: {
    dump: () => SharedDatabaseDump;
  };
  troubleTickets: {
    getAll: () => ReadonlyArray<TroubleTicket>;
  };
};

export const initSharedReadModel = (
  eventStoreClient: Client,
  logger: Logger,
  googleHelpers: O.Option<GoogleHelpers>,
  googleRateLimitMs: number,
  cacheSheetData: Dependencies['cacheSheetData'],
  cacheTroubleTicketData: Dependencies['cacheTroubleTicketData']
): SharedReadModel => {
  const _underlyingReadModelDb = new Database();
  const readModelDb = drizzle(_underlyingReadModelDb);
  createTables.forEach(statement => readModelDb.run(statement));
  const updateState_ = updateState(readModelDb);

  return {
    db: readModelDb,
    _underlyingReadModelDb,
    asyncRefresh: asyncRefresh(eventStoreClient, updateState_),
    updateState: updateState_,
    asyncApplyExternalEventSources: asyncApplyExternalEventSources(
      logger,
      readModelDb,
      googleHelpers,
      updateState_,
      googleRateLimitMs,
      cacheSheetData,
      cacheTroubleTicketData
    ),
    members: {
      get: getMemberFull(readModelDb),
      getAll: getAllMemberFull(readModelDb),
      getAsActor: getMemberAsActorFull(readModelDb),
    },
    equipment: {
      get: getEquipmentFull(readModelDb),
      getAll: getAllEquipmentFull(readModelDb),
    },
    area: {
      get: getAreaFull(readModelDb),
      getAll: getAllAreaFull(readModelDb),
    },
    debug: {
      dump: dumpCurrentState(readModelDb),
    },
    troubleTickets: {
      getAll: getAllTroubleTicketFull(readModelDb),
    },
  };
};
