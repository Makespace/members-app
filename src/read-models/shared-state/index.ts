import {DomainEvent} from '../../types/domain-event';
import * as O from 'fp-ts/Option';
import {gravatarHashFromEmail} from '../members/avatar';
import {createTables, membersTable} from './state';
import {BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import {Member} from '../members';
import {getMember} from './get-member';
import {eq} from 'drizzle-orm';

export {replayState} from './deprecated-replay';

const updateState = (db: BetterSQLite3Database) => (event: DomainEvent) => {
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
        })
        .run();
      break;
    case 'MemberDetailsUpdated':
      if (event.name) {
        db.update(membersTable)
          .set({name: O.some(event.name)})
          .run();
      }
      if (event.pronouns) {
        db.update(membersTable)
          .set({pronouns: O.some(event.pronouns)})
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
