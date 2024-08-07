import {DomainEvent} from '../../types/domain-event';
import * as T from 'fp-ts/Task';
import * as O from 'fp-ts/Option';
import {gravatarHashFromEmail} from '../members/avatar';
import {
  createTables,
  equipmentTable,
  membersTable,
  trainedMemberstable,
  trainersTable,
} from './state';
import {BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import {Member} from '../members';
import {getMember} from './get-member';
import {eq} from 'drizzle-orm';
import {Equipment} from './return-types';
import {getEquipment} from './get-equipment';
import {Client} from '@libsql/client/.';
import {asyncRefresh} from './async-refresh';

export {replayState} from './deprecated-replay';

export const updateState =
  (db: BetterSQLite3Database) => (event: DomainEvent) => {
    switch (event.type) {
      case 'MemberNumberLinkedToEmail':
        db.insert(membersTable)
          .values({
            memberNumber: event.memberNumber,
            emailAddress: event.email,
            gravatarHash: gravatarHashFromEmail(event.email),
            name: O.none,
            pronouns: O.none,
            prevEmails: [],
            isSuperUser: false,
          })
          .run();
        break;
      case 'MemberDetailsUpdated':
        if (event.name) {
          db.update(membersTable)
            .set({name: O.some(event.name)})
            .where(eq(membersTable.memberNumber, event.memberNumber))
            .run();
        }
        if (event.pronouns) {
          db.update(membersTable)
            .set({pronouns: O.some(event.pronouns)})
            .where(eq(membersTable.memberNumber, event.memberNumber))
            .run();
        }
        break;
      case 'MemberEmailChanged': {
        const current = db
          .select()
          .from(membersTable)
          .where(eq(membersTable.memberNumber, event.memberNumber))
          .get();
        if (current) {
          db.update(membersTable)
            .set({
              emailAddress: event.newEmail,
              prevEmails: [...current.prevEmails, current.emailAddress],
              gravatarHash: gravatarHashFromEmail(event.newEmail),
            })
            .where(eq(membersTable.memberNumber, event.memberNumber))
            .run();
        }
        break;
      }
      case 'SuperUserDeclared':
        db.update(membersTable)
          .set({isSuperUser: true})
          .where(eq(membersTable.memberNumber, event.memberNumber))
          .run();
        break;
      case 'SuperUserRevoked':
        db.update(membersTable)
          .set({isSuperUser: false})
          .where(eq(membersTable.memberNumber, event.memberNumber))
          .run();
        break;
      case 'EquipmentAdded':
        db.insert(equipmentTable)
          .values({id: event.id, name: event.name})
          .run();
        break;
      case 'TrainerAdded':
        db.insert(trainersTable)
          .values({
            memberNumber: event.memberNumber,
            equipmentId: event.equipmentId,
          })
          .run();
        break;
      case 'MemberTrainedOnEquipment':
        db.insert(trainedMemberstable)
          .values({
            memberNumber: event.memberNumber,
            equipmentId: event.equipmentId,
          })
          .run();
        break;

      default:
        break;
    }
  };

export type SharedReadModel = {
  db: BetterSQLite3Database;
  asyncRefresh: () => T.Task<void>;
  refresh: (events: ReadonlyArray<DomainEvent>) => void;
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
  let knownEvents = 0;
  const readModelDb = drizzle(new Database());
  return {
    db: readModelDb,
    asyncRefresh: asyncRefresh(eventStoreClient, readModelDb),
    refresh: events => {
      if (knownEvents === events.length) {
        return;
      }
      if (knownEvents === 0) {
        createTables.forEach(statement => readModelDb.run(statement));
        knownEvents = events.length;
        events.forEach(updateState(readModelDb));
        return;
      }
      knownEvents = events.length;
    },
    members: {
      get: getMember(readModelDb),
    },
    equipment: {
      get: getEquipment(readModelDb),
    },
  };
};
