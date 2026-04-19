import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import * as T from 'fp-ts/Task';
import * as O from 'fp-ts/Option';
import {createTables} from './state';
import {BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import {Area, Equipment, Member, MemberCoreInfo} from './return-types';

import {Client} from '@libsql/client';
import {asyncRefresh} from './async-refresh';
import {updateState} from './update-state';
import {Logger} from 'pino';
import {UUID} from 'io-ts-types';
import {EmailAddress, StoredDomainEvent, User, UserId} from '../../types';
import {getAllEquipmentFull, getEquipmentFull} from './equipment/helpers';
import {getAllAreaFull, getAreaFull} from './area/helpers';
import {
  getAllMemberFull,
  getMemberAsActorFull,
  getMemberFullByMemberNumber,
  getMemberFullByEmail,
  getMemberFullByUserId,
} from './member/helper';
import {dumpCurrentState, SharedDatabaseDump} from './debug/dump';
import {DateTime} from 'luxon';
import {getLastSent} from './training-stat-notifications/get-last-sent';
import { ReadonlyRecord } from 'fp-ts/lib/ReadonlyRecord';
import { TrainingSheetId } from '../../types/training-sheet';
import { EquipmentId } from '../../types/equipment-id';
import { getTrainingSheetIdMapping } from './equipment/get';
import { findAllSuperUsers, findUserIdByEmail, findUserIdByMemberNumber } from './member/get';
import { setupEventStateTable } from './setup-event-state-table';
import { getCurrentEventIndex } from './get-current-event-index';
import { Int } from 'io-ts';

export type SharedReadModel = {
  db: BetterSQLite3Database;
  readOnlyDb: BetterSQLite3Database;
  _underlyingReadModelDb: Database.Database; // This is exposed only to allow debug serialisation of the db.
  asyncRefresh: () => T.Task<void>;
  updateState: (event: StoredDomainEvent) => void;
  getCurrentEventIndex: () => Int;
  members: {
    getById: (userId: UserId) => O.Option<Member>;
    getByMemberNumber: (memberNumber: number) => O.Option<Member>;
    getByEmail: (email: EmailAddress, mustBeVerified: boolean) => O.Option<Member>;
    getAll: () => ReadonlyArray<Member>;
    getAsActor: (user: User) => (memberNumber: number) => O.Option<Member>;
    findUserIdByEmail: (email: EmailAddress, mustBeVerified: boolean) => O.Option<UserId>;
    findUserIdByMemberNumber: (memberNumber: number) => O.Option<UserId>;
    findAllSuperUsers: () => ReadonlyArray<MemberCoreInfo>;
  };
  equipment: {
    get: (id: UUID) => O.Option<Equipment>;
    getAll: () => ReadonlyArray<Equipment>;
    getTrainingSheetIdMapping: () => ReadonlyRecord<TrainingSheetId, EquipmentId>;
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
): SharedReadModel => {
  const randomFileName = crypto.randomBytes(16).toString('hex');
  const uri = path.join(os.tmpdir(), `${randomFileName}.db`);
  fs.rmSync(uri, {force: true});
  const _underlyingReadModelDb = new Database(uri);
  const readModelDb = drizzle(_underlyingReadModelDb);
  const readOnlyReadModelDb = drizzle(new Database(uri, {readonly: true}));

  createTables.forEach(statement => readModelDb.run(statement));
  const getCurrentEventIndex_ = getCurrentEventIndex(readModelDb);
  const updateState_ = updateState(readModelDb, logger, true);

  setupEventStateTable(readModelDb);

  return {
    db: readModelDb,
    readOnlyDb: readOnlyReadModelDb,
    _underlyingReadModelDb,
    asyncRefresh: asyncRefresh(eventStoreClient, getCurrentEventIndex_, updateState_),
    updateState: updateState_,
    getCurrentEventIndex: getCurrentEventIndex_,
    members: {
      getByMemberNumber: getMemberFullByMemberNumber(readModelDb),
      getByEmail: getMemberFullByEmail(readModelDb),
      getById: getMemberFullByUserId(readModelDb),
      getAll: getAllMemberFull(readModelDb),
      getAsActor: getMemberAsActorFull(readModelDb),
      findUserIdByEmail: findUserIdByEmail(readModelDb),
      findUserIdByMemberNumber: findUserIdByMemberNumber(readModelDb),
      findAllSuperUsers: () => findAllSuperUsers(readModelDb),
    },
    equipment: {
      get: getEquipmentFull(readModelDb),
      getAll: getAllEquipmentFull(readModelDb),
      getTrainingSheetIdMapping: getTrainingSheetIdMapping(readModelDb),
    },
    area: {
      get: getAreaFull(readModelDb),
      getAll: getAllAreaFull(readModelDb),
    },
    debug: {
      dump: dumpCurrentState(readModelDb),
    },
    trainingStats: {
      getLastSent: getLastSent(readModelDb),
    },
  };
};
