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
        .get(),
      O.fromNullable,
      O.map(
        partial =>
          ({
            ...partial,
            trainedOn: [],
          }) satisfies Member
      )
    );
