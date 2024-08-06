import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {membersTable} from './state';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {Member} from '../members';
import {eq} from 'drizzle-orm';
import {SharedReadModel} from '.';

export const getMember =
  (db: BetterSQLite3Database): SharedReadModel['members']['get'] =>
  (memberNumber): O.Option<Member> =>
    pipe(
      db
        .select()
        .from(membersTable)
        .where(eq(membersTable.memberNumber, memberNumber))
        .all(),
      RA.head,
      O.map(
        partial =>
          ({
            ...partial,
            trainedOn: [],
            prevEmails: [],
            agreementSigned: O.none,
            isSuperUser: false,
          }) satisfies Member
      )
    );
