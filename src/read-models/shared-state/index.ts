import {DomainEvent} from '../../types/domain-event';
import * as O from 'fp-ts/Option';
import {gravatarHashFromEmail} from '../members/avatar';
import {createTables, membersTable} from './state';
import {BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import {Member} from '../members';
import {getMember} from './get-member';

export {replayState} from './deprecated-replay';

const updateState = (db: BetterSQLite3Database) => (event: DomainEvent) => {
  switch (event.type) {
    case 'MemberNumberLinkedToEmail':
      db.insert(membersTable)
        .values({
          memberNumber: event.memberNumber,
          emailAddress: event.email,
          gravatarHash: gravatarHashFromEmail(event.email),
        })
        .run();
      break;

    default:
      break;
  }
};

export type SharedReadModel = {
  db: BetterSQLite3Database;
  refresh: (events: ReadonlyArray<DomainEvent>) => void;
  members: {
    get: (memberNumber: number) => O.Option<Member>;
  };
};

export const initSharedReadModel = (): SharedReadModel => {
  let knownEvents = 0;
  const db = drizzle(new Database());
  return {
    db,
    refresh: events => {
      if (knownEvents === events.length) {
        return;
      }
      if (knownEvents === 0) {
        db.run(createTables);
        knownEvents = events.length;
        events.forEach(updateState(db));
        return;
      }
      knownEvents = events.length;
    },
    members: {
      get: getMember(db),
    },
  };
};
