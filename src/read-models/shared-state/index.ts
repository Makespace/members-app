import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import * as T from 'fp-ts/Task';
import * as O from 'fp-ts/Option';
import {createTables} from './state';
import {BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import {Area, Equipment, Member} from './return-types';

import {Client} from '@libsql/client/.';
import {asyncRefresh} from './async-refresh';
import {updateState} from './update-state';
import {Logger} from 'pino';
import {asyncApplyExternalEventSources} from './async-apply-external-event-sources';
import {UUID} from 'io-ts-types';
import {User} from '../../types';
import {getAllEquipmentFull, getEquipmentFull} from './equipment/helpers';
import {getAllAreaFull, getAreaFull} from './area/helpers';
import {
  getAllMemberFull,
  getMemberFull,
  getMemberAsActorFull,
} from './member/helper';
import {dumpCurrentState, SharedDatabaseDump} from './debug/dump';
import {MemberLinking} from './member-linking';
import {DateTime} from 'luxon';
import {getLastSent} from './training-stat-notifications/get-last-sent';

export type SharedReadModel = {
  db: BetterSQLite3Database;
  readOnlyDb: BetterSQLite3Database;
  _underlyingReadModelDb: Database.Database; // This is exposed only to allow debug serialisation of the db.
  linking: MemberLinking;
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
  trainingStats: {
    getLastSent: (memberNumber: number) => O.Option<DateTime>;
  };
};

export const initSharedReadModel = (
  eventStoreClient: Client,
  logger: Logger,
  recurlyToken: O.Option<string>
): SharedReadModel => {
  const randomFileName = crypto.randomBytes(16).toString('hex');
  const uri = path.join(os.tmpdir(), `${randomFileName}.db`);
  fs.rmSync(uri, {force: true});
  const _underlyingReadModelDb = new Database(uri);
  const readModelDb = drizzle(_underlyingReadModelDb);
  const readOnlyReadModelDb = drizzle(new Database(uri, {readonly: true}));

  createTables.forEach(statement => readModelDb.run(statement));
  const linking = new MemberLinking();
  const updateState_ = updateState(readModelDb, linking);

  return {
    db: readModelDb,
    readOnlyDb: readOnlyReadModelDb,
    linking,
    _underlyingReadModelDb,
    asyncRefresh: asyncRefresh(eventStoreClient, updateState_),
    updateState: updateState_,
    asyncApplyExternalEventSources: asyncApplyExternalEventSources(
      logger,
      readModelDb,
      updateState_,
      recurlyToken
    ),
    members: {
      get: getMemberFull(readModelDb, linking),
      getAll: getAllMemberFull(readModelDb, linking),
      getAsActor: getMemberAsActorFull(readModelDb, linking),
    },
    equipment: {
      get: getEquipmentFull(readModelDb, linking),
      getAll: getAllEquipmentFull(readModelDb, linking),
    },
    area: {
      get: getAreaFull(readModelDb, linking),
      getAll: getAllAreaFull(readModelDb, linking),
    },
    debug: {
      dump: dumpCurrentState(readModelDb),
    },
    trainingStats: {
      getLastSent: getLastSent(readModelDb, linking),
    },
  };
};
